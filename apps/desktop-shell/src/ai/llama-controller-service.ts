import path from 'node:path';
import type {
  LlamaControllerBenchmarkRequest,
  LlamaControllerBenchmarkResponse,
  LlamaControllerHealthRequest,
  LlamaControllerHealthResponse,
  LlamaControllerStartPayload,
  LlamaControllerStopPayload,
  TelemetryTrackPayload
} from '@nexus/contracts/ipc';
import {
  LlamaCppController,
  type LlamaControllerBenchmarkResult,
  type LlamaControllerHealthSnapshot
} from '@nexus/ai-core/controller/llama-controller';
import type { NexusEnv } from '@nexus/platform/config/env';

type TelemetrySink = {
  track: (payload: TelemetryTrackPayload) => unknown;
};

type LlamaControllerLike = {
  start: (payload: {
    modelPath: string;
    host?: string;
    port?: number;
    threads?: number;
    contextSize?: number;
    batchSize?: number;
    gpuPreference?: 'auto' | 'cpu' | 'gpu';
    gpuLayers?: number;
    restartOnCrash?: boolean;
    extraArgs?: string[];
  }) => Promise<LlamaControllerHealthSnapshot>;
  stop: (payload?: { force?: boolean }) => Promise<LlamaControllerHealthSnapshot>;
  getHealth: () => Promise<LlamaControllerHealthSnapshot>;
  benchmark: (payload?: LlamaControllerBenchmarkRequest) => Promise<LlamaControllerBenchmarkResult>;
};

type LlamaControllerServiceOptions = {
  controller?: LlamaControllerLike;
  telemetry?: TelemetrySink;
};

export class LlamaControllerService {
  private readonly controller: LlamaControllerLike;
  private readonly telemetry?: TelemetrySink;
  private readonly modelRoot: string;

  constructor(env: NexusEnv, options: LlamaControllerServiceOptions = {}) {
    this.telemetry = options.telemetry;
    this.modelRoot = path.join(env.nexusDataDir, 'ai', 'models');
    this.controller =
      options.controller ??
      new LlamaCppController({
        installRoot: env.llamaCppRootDir,
        binaryPath: env.llamaCppBinaryPath,
        legacyInstallRoots: [path.join(env.nexusHome, 'llama.cpp')],
        host: env.llamaCppHost,
        port: env.llamaCppPort,
        healthTimeoutMs: env.llamaCppHealthTimeoutMs
      });
  }

  async getHealth(request: LlamaControllerHealthRequest = {}): Promise<LlamaControllerHealthResponse> {
    void request;
    return this.controller.getHealth();
  }

  async start(payload: LlamaControllerStartPayload): Promise<LlamaControllerHealthResponse> {
    const resolvedModelPath = this.resolveModelPath(payload.modelPath);
    const response = await this.controller.start({
      ...payload,
      modelPath: resolvedModelPath
    });
    this.track('ai.controller.start', {
      modelPath: resolvedModelPath,
      host: response.host,
      port: response.port,
      gpuPreference: response.configuration?.gpuPreference ?? 'auto'
    });
    return response;
  }

  async stop(payload: LlamaControllerStopPayload = {}): Promise<LlamaControllerHealthResponse> {
    const response = await this.controller.stop(payload);
    this.track('ai.controller.stop', {
      force: Boolean(payload.force),
      status: response.status
    });
    return response;
  }

  async benchmark(payload: LlamaControllerBenchmarkRequest = {}): Promise<LlamaControllerBenchmarkResponse> {
    const result = await this.controller.benchmark(payload);
    const health = await this.controller.getHealth();
    this.track(
      'ai.controller.benchmark',
      {
        endpoint: health.endpoint,
        failures: result.summary.failures,
        successes: result.summary.successes
      },
      {
        avgLatencyMs: result.summary.avgLatencyMs ?? 0,
        p95LatencyMs: result.summary.p95LatencyMs ?? 0
      }
    );
    return {
      ...result,
      endpoint: health.endpoint
    };
  }

  private resolveModelPath(modelPath: string) {
    return path.isAbsolute(modelPath) ? path.resolve(modelPath) : path.resolve(this.modelRoot, modelPath);
  }

  private track(name: string, attributes: Record<string, string | number | boolean>, measurements?: Record<string, number>) {
    this.telemetry?.track({
      name,
      scope: 'main',
      level: 'info',
      attributes,
      measurements
    });
  }
}
