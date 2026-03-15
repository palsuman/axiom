import { EventEmitter } from 'node:events';
import type { PathLike } from 'node:fs';
import path from 'node:path';
import {
  LlamaCppController,
  buildLlamaServerArgs,
  resolveLlamaCppBinary
} from './llama-controller';

class MockChildProcess extends EventEmitter {
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();
  killedWith?: NodeJS.Signals;

  constructor(readonly pid: number) {
    super();
  }

  kill(signal: NodeJS.Signals = 'SIGTERM') {
    this.killedWith = signal;
    this.emit('exit', signal === 'SIGKILL' ? 137 : 0, signal);
    return true;
  }
}

describe('resolveLlamaCppBinary', () => {
  it('finds modern and legacy llama.cpp server binaries', () => {
    const existing = new Set([
      '/runtime/ai/llama.cpp/build/bin/llama-server',
      '/legacy/llama.cpp/server'
    ]);
    const fs = {
      existsSync: (target: PathLike) => existing.has(String(target))
    };

    expect(
      resolveLlamaCppBinary({
        installRoot: '/runtime/ai/llama.cpp',
        fs
      })
    ).toEqual({
      installRoot: '/runtime/ai/llama.cpp',
      binaryPath: '/runtime/ai/llama.cpp/build/bin/llama-server',
      installed: true
    });

    expect(
      resolveLlamaCppBinary({
        installRoot: '/missing',
        legacyInstallRoots: ['/legacy/llama.cpp'],
        fs
      })
    ).toEqual({
      installRoot: '/legacy/llama.cpp',
      binaryPath: '/legacy/llama.cpp/server',
      installed: true
    });
  });
});

describe('buildLlamaServerArgs', () => {
  it('builds llama-server arguments for CPU and GPU flows', () => {
    expect(
      buildLlamaServerArgs({
        modelPath: '/models/coder.gguf',
        host: '127.0.0.1',
        port: 8080,
        threads: 8,
        contextSize: 4096,
        batchSize: 512,
        gpuPreference: 'cpu'
      })
    ).toEqual([
      '--model',
      path.resolve('/models/coder.gguf'),
      '--host',
      '127.0.0.1',
      '--port',
      '8080',
      '--ctx-size',
      '4096',
      '--threads',
      '8',
      '--batch-size',
      '512',
      '--n-gpu-layers',
      '0',
      '--metrics'
    ]);
  });
});

describe('LlamaCppController', () => {
  it('reports missing install state before start', async () => {
    const controller = new LlamaCppController(
      {
        installRoot: '/runtime/ai/llama.cpp',
        host: '127.0.0.1',
        port: 39281,
        healthTimeoutMs: 100
      },
      {
        fs: {
          existsSync: () => false
        }
      }
    );

    const health = await controller.getHealth();

    expect(health.installed).toBe(false);
    expect(health.health.error).toMatch(/binary not found/);
  });

  it('starts, probes health, and stops the controller process', async () => {
    const child = new MockChildProcess(1412);
    const spawnProcess = jest.fn(() => child as never);
    const fetchApi = jest.fn().mockResolvedValue({
      ok: true,
      status: 200
    });
    const controller = new LlamaCppController(
      {
        installRoot: '/runtime/ai/llama.cpp',
        host: '127.0.0.1',
        port: 39281,
        healthTimeoutMs: 100
      },
      {
        fs: {
          existsSync: (target: PathLike) => String(target) === '/runtime/ai/llama.cpp/build/bin/llama-server'
        },
        spawn: spawnProcess,
        fetch: fetchApi
      }
    );

    const started = await controller.start({
      modelPath: '/models/coder.gguf',
      threads: 8,
      gpuPreference: 'cpu'
    });

    expect(spawnProcess).toHaveBeenCalledWith(
      '/runtime/ai/llama.cpp/build/bin/llama-server',
      expect.arrayContaining(['--model', path.resolve('/models/coder.gguf')]),
      expect.objectContaining({ stdio: 'pipe' })
    );
    expect(started.status).toBe('running');
    expect(started.health.ok).toBe(true);

    const stopped = await controller.stop();
    expect(child.killedWith).toBe('SIGTERM');
    expect(stopped.status).toBe('stopped');
  });

  it('auto-restarts after unexpected exit when enabled', async () => {
    jest.useFakeTimers();
    const first = new MockChildProcess(2001);
    const second = new MockChildProcess(2002);
    const spawnProcess = jest.fn().mockReturnValueOnce(first as never).mockReturnValueOnce(second as never);
    const fetchApi = jest.fn().mockResolvedValue({
      ok: true,
      status: 200
    });
    const controller = new LlamaCppController(
      {
        installRoot: '/runtime/ai/llama.cpp',
        host: '127.0.0.1',
        port: 39281,
        healthTimeoutMs: 100,
        restartDelayMs: 50
      },
      {
        fs: {
          existsSync: (target: PathLike) => String(target) === '/runtime/ai/llama.cpp/build/bin/llama-server'
        },
        spawn: spawnProcess,
        fetch: fetchApi
      }
    );

    await controller.start({
      modelPath: '/models/coder.gguf',
      restartOnCrash: true
    });

    first.emit('exit', 1, null);
    await jest.advanceTimersByTimeAsync(55);

    const health = await controller.getHealth();
    expect(spawnProcess).toHaveBeenCalledTimes(2);
    expect(health.process.restarts).toBe(1);
    expect(['restarting', 'running']).toContain(health.status);

    jest.useRealTimers();
  });
});
