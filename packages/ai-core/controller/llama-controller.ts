import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process';
import {
  runLlamaHealthBenchmark,
  type LlamaHealthBenchmarkResult,
  type LlamaHealthCheckResult
} from './llama-benchmark';

export type { LlamaHealthBenchmarkResult as LlamaControllerBenchmarkResult } from './llama-benchmark';

export type LlamaControllerStatus = 'stopped' | 'starting' | 'running' | 'degraded' | 'restarting' | 'crashed';

export type LlamaGpuPreference = 'auto' | 'cpu' | 'gpu';

export type LlamaControllerRuntimeConfig = {
  installRoot: string;
  binaryPath?: string;
  legacyInstallRoots?: string[];
  host: string;
  port: number;
  healthTimeoutMs: number;
  startupTimeoutMs?: number;
  restartDelayMs?: number;
  maxRestartCount?: number;
  outputBufferSize?: number;
};

export type LlamaControllerStartOptions = {
  modelPath: string;
  host?: string;
  port?: number;
  threads?: number;
  contextSize?: number;
  batchSize?: number;
  gpuPreference?: LlamaGpuPreference;
  gpuLayers?: number;
  restartOnCrash?: boolean;
  extraArgs?: string[];
};

export type LlamaControllerStopOptions = {
  force?: boolean;
};

export type LlamaControllerProcessState = {
  pid?: number;
  startedAt?: number;
  restarts: number;
  restartOnCrash: boolean;
  lastExitCode?: number;
  lastExitSignal?: string;
  lastExitAt?: number;
};

export type LlamaControllerHealthSnapshot = {
  status: LlamaControllerStatus;
  installRoot: string;
  binaryPath?: string;
  installed: boolean;
  endpoint: string;
  host: string;
  port: number;
  modelPath?: string;
  process: LlamaControllerProcessState;
  health: LlamaHealthCheckResult;
  configuration?: {
    threads?: number;
    contextSize?: number;
    batchSize?: number;
    gpuPreference: LlamaGpuPreference;
    gpuLayers?: number;
    extraArgs: string[];
  };
  recentOutput: string[];
};

export type LlamaControllerBenchmarkRequest = {
  iterations?: number;
  warmupIterations?: number;
};

type FetchResponseLike = {
  ok: boolean;
  status: number;
};

type FetchLike = (input: string, init?: { signal?: AbortSignal }) => Promise<FetchResponseLike>;

type SpawnLike = (
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio
) => ChildProcessWithoutNullStreams;

type TimerApi = {
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
};

type LlamaControllerOptions = {
  fs?: Pick<typeof fs, 'existsSync'>;
  spawn?: SpawnLike;
  fetch?: FetchLike;
  timer?: TimerApi;
};

type NormalizedRuntimeConfig = {
  installRoot: string;
  binaryPath?: string;
  legacyInstallRoots: string[];
  host: string;
  port: number;
  healthTimeoutMs: number;
  startupTimeoutMs: number;
  restartDelayMs: number;
  maxRestartCount: number;
  outputBufferSize: number;
};

type ResolvedBinary = {
  installRoot: string;
  binaryPath?: string;
  installed: boolean;
};

type ActiveStartState = Required<Pick<LlamaControllerStartOptions, 'modelPath'>> &
  Omit<LlamaControllerStartOptions, 'modelPath'> & {
    modelPath: string;
    host: string;
    port: number;
    gpuPreference: LlamaGpuPreference;
    restartOnCrash: boolean;
    extraArgs: string[];
  };

const DEFAULT_RESTART_DELAY_MS = 500;
const DEFAULT_MAX_RESTARTS = 3;
const DEFAULT_OUTPUT_BUFFER_SIZE = 40;

export class LlamaCppController extends EventEmitter {
  private readonly fsApi: Pick<typeof fs, 'existsSync'>;
  private readonly spawnProcess: SpawnLike;
  private readonly fetchApi?: FetchLike;
  private readonly timer: TimerApi;
  private readonly runtime: NormalizedRuntimeConfig;

  private child?: ChildProcessWithoutNullStreams;
  private status: LlamaControllerStatus = 'stopped';
  private desiredRunning = false;
  private stopping = false;
  private restartTimer?: ReturnType<typeof setTimeout>;
  private startState?: ActiveStartState;
  private recentOutput: string[] = [];
  private health: LlamaHealthCheckResult = {
    ok: false,
    checkedAt: 0,
    error: 'controller not started'
  };
  private processState: LlamaControllerProcessState = {
    restarts: 0,
    restartOnCrash: true
  };
  private currentBinary?: string;
  private currentInstallRoot: string;

  constructor(runtime: LlamaControllerRuntimeConfig, options: LlamaControllerOptions = {}) {
    super();
    this.fsApi = options.fs ?? fs;
    this.spawnProcess = options.spawn ?? spawn;
    this.fetchApi =
      options.fetch ??
      (typeof globalThis.fetch === 'function' ? ((globalThis.fetch as unknown) as FetchLike) : undefined);
    this.timer = options.timer ?? globalThis;
    this.runtime = {
      installRoot: runtime.installRoot,
      binaryPath: runtime.binaryPath,
      legacyInstallRoots: runtime.legacyInstallRoots ?? [],
      host: runtime.host,
      port: runtime.port,
      healthTimeoutMs: runtime.healthTimeoutMs,
      startupTimeoutMs: runtime.startupTimeoutMs ?? Math.max(runtime.healthTimeoutMs * 4, 10000),
      restartDelayMs: runtime.restartDelayMs ?? DEFAULT_RESTART_DELAY_MS,
      maxRestartCount: runtime.maxRestartCount ?? DEFAULT_MAX_RESTARTS,
      outputBufferSize: runtime.outputBufferSize ?? DEFAULT_OUTPUT_BUFFER_SIZE
    };
    this.currentInstallRoot = runtime.installRoot;
  }

  async start(options: LlamaControllerStartOptions): Promise<LlamaControllerHealthSnapshot> {
    const nextState = this.normalizeStartOptions(options);
    this.desiredRunning = true;
    this.stopping = false;

    if (this.child) {
      await this.stop();
    }

    this.startState = nextState;
    this.processState = {
      restarts: 0,
      restartOnCrash: nextState.restartOnCrash
    };

    await this.spawnCurrentProcess(nextState, 'starting');
    await this.waitForHealthy(this.runtime.startupTimeoutMs);
    return this.snapshot();
  }

  async stop(options: LlamaControllerStopOptions = {}): Promise<LlamaControllerHealthSnapshot> {
    this.desiredRunning = false;
    this.stopping = true;
    this.clearRestartTimer();

    if (!this.child) {
      this.status = 'stopped';
      this.health = {
        ok: false,
        checkedAt: Date.now(),
        error: 'controller stopped'
      };
      return this.snapshot();
    }

    const child = this.child;
    await new Promise<void>(resolve => {
      child.once('exit', () => resolve());
      child.kill(options.force ? 'SIGKILL' : 'SIGTERM');
    });

    this.status = 'stopped';
    this.health = {
      ok: false,
      checkedAt: Date.now(),
      error: 'controller stopped'
    };
    return this.snapshot();
  }

  async getHealth(): Promise<LlamaControllerHealthSnapshot> {
    if (this.child) {
      await this.refreshHealth();
    } else if (!this.currentBinary) {
      const resolved = resolveLlamaCppBinary({
        installRoot: this.runtime.installRoot,
        binaryPath: this.runtime.binaryPath,
        legacyInstallRoots: this.runtime.legacyInstallRoots,
        fs: this.fsApi
      });
      this.currentBinary = resolved.binaryPath;
      this.currentInstallRoot = resolved.installRoot;
      this.health = {
        ok: false,
        checkedAt: Date.now(),
        error: resolved.installed ? 'controller not started' : 'llama.cpp server binary not found'
      };
    }
    return this.snapshot();
  }

  async benchmark(request: LlamaControllerBenchmarkRequest = {}): Promise<LlamaHealthBenchmarkResult> {
    return runLlamaHealthBenchmark(() => this.probeHealth(), request);
  }

  async dispose() {
    await this.stop({ force: true });
    this.removeAllListeners();
  }

  private async spawnCurrentProcess(nextState: ActiveStartState, requestedStatus: 'starting' | 'restarting') {
    const resolved = resolveLlamaCppBinary({
      installRoot: this.runtime.installRoot,
      binaryPath: this.runtime.binaryPath,
      legacyInstallRoots: this.runtime.legacyInstallRoots,
      fs: this.fsApi
    });
    this.currentBinary = resolved.binaryPath;
    this.currentInstallRoot = resolved.installRoot;
    if (!resolved.installed || !resolved.binaryPath) {
      this.status = 'crashed';
      this.health = {
        ok: false,
        checkedAt: Date.now(),
        error: 'llama.cpp server binary not found'
      };
      throw new Error(`Unable to locate llama.cpp server binary under ${resolved.installRoot}`);
    }

    this.recentOutput = [];
    this.status = requestedStatus;
    this.health = {
      ok: false,
      checkedAt: Date.now(),
      error: 'starting'
    };

    const child = this.spawnProcess(resolved.binaryPath, buildLlamaServerArgs(nextState), {
      stdio: 'pipe'
    });
    this.child = child;
    this.processState = {
      ...this.processState,
      pid: child.pid,
      startedAt: Date.now()
    };
    child.stdout.on('data', chunk => this.recordOutput(chunk));
    child.stderr.on('data', chunk => this.recordOutput(chunk));
    child.on('exit', (code, signal) => this.handleExit(code, signal));
  }

  private async waitForHealthy(timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
      const health = await this.refreshHealth();
      if (health.ok) {
        return;
      }
      if (!this.child) {
        return;
      }
      await sleep(200, this.timer);
    }
  }

  private async refreshHealth() {
    this.health = await this.probeHealth();
    if (this.child) {
      this.status = this.health.ok ? 'running' : this.status === 'restarting' ? 'restarting' : 'degraded';
    }
    return this.health;
  }

  private async probeHealth(): Promise<LlamaHealthCheckResult> {
    if (!this.fetchApi) {
      return {
        ok: false,
        checkedAt: Date.now(),
        error: 'health fetch implementation unavailable'
      };
    }

    const endpoint = buildHealthEndpoint(this.startState?.host ?? this.runtime.host, this.startState?.port ?? this.runtime.port);
    return probeHttpHealth(this.fetchApi, endpoint, this.runtime.healthTimeoutMs);
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null) {
    this.child = undefined;
    this.processState = {
      ...this.processState,
      pid: undefined,
      lastExitCode: code ?? undefined,
      lastExitSignal: signal ?? undefined,
      lastExitAt: Date.now()
    };

    if (this.stopping || !this.desiredRunning) {
      this.status = 'stopped';
      return;
    }

    this.status = 'crashed';
    this.health = {
      ok: false,
      checkedAt: Date.now(),
      error: `process exited${code !== null ? ` with code ${code}` : ''}${signal ? ` (${signal})` : ''}`
    };

    const canRestart =
      Boolean(this.startState?.restartOnCrash) && this.processState.restarts < this.runtime.maxRestartCount;
    if (!canRestart || !this.startState) {
      return;
    }

    this.processState = {
      ...this.processState,
      restarts: this.processState.restarts + 1
    };
    this.status = 'restarting';
    this.restartTimer = this.timer.setTimeout(() => {
      this.restartTimer = undefined;
      const state = this.startState;
      if (!state || !this.desiredRunning) {
        return;
      }
      void this.spawnCurrentProcess(state, 'restarting')
        .then(() => this.waitForHealthy(this.runtime.startupTimeoutMs))
        .catch(error => {
          this.status = 'crashed';
          this.health = {
            ok: false,
            checkedAt: Date.now(),
            error: error instanceof Error ? error.message : String(error)
          };
        });
    }, this.runtime.restartDelayMs);
  }

  private snapshot(): LlamaControllerHealthSnapshot {
    const resolvedBinary = this.currentBinary;
    const host = this.startState?.host ?? this.runtime.host;
    const port = this.startState?.port ?? this.runtime.port;
    return {
      status: this.status,
      installRoot: this.currentInstallRoot,
      binaryPath: resolvedBinary,
      installed: Boolean(resolvedBinary),
      endpoint: buildHealthEndpoint(host, port),
      host,
      port,
      modelPath: this.startState?.modelPath,
      process: {
        ...this.processState
      },
      health: {
        ...this.health
      },
      configuration: this.startState
        ? {
            threads: this.startState.threads,
            contextSize: this.startState.contextSize,
            batchSize: this.startState.batchSize,
            gpuPreference: this.startState.gpuPreference,
            gpuLayers: this.startState.gpuLayers,
            extraArgs: [...this.startState.extraArgs]
          }
        : undefined,
      recentOutput: [...this.recentOutput]
    };
  }

  private normalizeStartOptions(options: LlamaControllerStartOptions): ActiveStartState {
    const modelPath = path.resolve(options.modelPath);
    if (!modelPath.trim()) {
      throw new Error('modelPath is required');
    }
    return {
      modelPath,
      host: options.host?.trim() || this.runtime.host,
      port: options.port ?? this.runtime.port,
      threads: options.threads,
      contextSize: options.contextSize,
      batchSize: options.batchSize,
      gpuPreference: options.gpuPreference ?? 'auto',
      gpuLayers: options.gpuLayers,
      restartOnCrash: options.restartOnCrash ?? true,
      extraArgs: options.extraArgs ?? []
    };
  }

  private recordOutput(chunk: Buffer | string) {
    const lines = String(chunk)
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    if (!lines.length) {
      return;
    }
    this.recentOutput.push(...lines);
    this.recentOutput = this.recentOutput.slice(-this.runtime.outputBufferSize);
  }

  private clearRestartTimer() {
    if (!this.restartTimer) {
      return;
    }
    this.timer.clearTimeout(this.restartTimer);
    this.restartTimer = undefined;
  }
}

export function buildLlamaServerArgs(options: ActiveStartState | LlamaControllerStartOptions) {
  const args = ['--model', path.resolve(options.modelPath), '--host', options.host ?? '127.0.0.1', '--port', String(options.port ?? 39281)];
  if (options.contextSize) {
    args.push('--ctx-size', String(options.contextSize));
  }
  if (options.threads) {
    args.push('--threads', String(options.threads));
  }
  if (options.batchSize) {
    args.push('--batch-size', String(options.batchSize));
  }
  if ((options.gpuPreference ?? 'auto') === 'cpu') {
    args.push('--n-gpu-layers', '0');
  } else if (typeof options.gpuLayers === 'number') {
    args.push('--n-gpu-layers', String(options.gpuLayers));
  }
  args.push('--metrics');
  args.push(...(options.extraArgs ?? []));
  return args;
}

export function resolveLlamaCppBinary(options: {
  installRoot: string;
  binaryPath?: string;
  legacyInstallRoots?: string[];
  fs?: Pick<typeof fs, 'existsSync'>;
}): ResolvedBinary {
  const fsApi = options.fs ?? fs;
  const roots = [options.installRoot, ...(options.legacyInstallRoots ?? [])].map(root => path.resolve(root));

  if (options.binaryPath) {
    const explicit = path.resolve(options.binaryPath);
    if (fsApi.existsSync(explicit)) {
      return {
        installRoot: path.dirname(explicit),
        binaryPath: explicit,
        installed: true
      };
    }
  }

  for (const root of roots) {
    for (const candidate of candidateBinaryPaths(root)) {
      if (fsApi.existsSync(candidate)) {
        return {
          installRoot: root,
          binaryPath: candidate,
          installed: true
        };
      }
    }
  }

  return {
    installRoot: roots[0],
    binaryPath: options.binaryPath ? path.resolve(options.binaryPath) : undefined,
    installed: false
  };
}

export async function probeHttpHealth(
  fetchApi: FetchLike,
  endpoint: string,
  timeoutMs: number
): Promise<LlamaHealthCheckResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchApi(endpoint, { signal: controller.signal });
    return {
      ok: response.ok,
      checkedAt: Date.now(),
      latencyMs: Date.now() - start,
      statusCode: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      ok: false,
      checkedAt: Date.now(),
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildHealthEndpoint(host: string, port: number) {
  return `http://${host}:${port}/health`;
}

function candidateBinaryPaths(root: string) {
  return [
    path.join(root, 'llama-server'),
    path.join(root, 'server'),
    path.join(root, 'build', 'bin', 'llama-server'),
    path.join(root, 'build', 'bin', 'server')
  ];
}

function sleep(ms: number, timer: TimerApi) {
  return new Promise<void>(resolve => {
    timer.setTimeout(() => resolve(), ms);
  });
}
