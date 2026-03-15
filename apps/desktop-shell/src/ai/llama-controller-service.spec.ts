import path from 'node:path';
import { LlamaControllerService } from './llama-controller-service';
import { createMockEnv } from '../test-utils/mock-env';

describe('LlamaControllerService', () => {
  it('resolves relative model paths under the nexus AI model root', async () => {
    const telemetry = {
      track: jest.fn()
    };
    const controller = {
      start: jest.fn().mockResolvedValue({
        status: 'running',
        installRoot: '/runtime/ai/llama.cpp',
        binaryPath: '/runtime/ai/llama.cpp/build/bin/llama-server',
        installed: true,
        endpoint: 'http://127.0.0.1:39281/health',
        host: '127.0.0.1',
        port: 39281,
        modelPath: '/ignored',
        process: {
          pid: 1001,
          startedAt: Date.now(),
          restarts: 0,
          restartOnCrash: true
        },
        health: {
          ok: true,
          checkedAt: Date.now(),
          latencyMs: 12,
          statusCode: 200
        },
        configuration: {
          gpuPreference: 'auto',
          extraArgs: []
        },
        recentOutput: []
      }),
      stop: jest.fn(),
      getHealth: jest.fn(),
      benchmark: jest.fn()
    };
    const env = createMockEnv({
      nexusDataDir: '/tmp/nexus-data'
    });
    const service = new LlamaControllerService(env, {
      controller,
      telemetry
    });

    await service.start({
      modelPath: 'codellama.gguf'
    });

    expect(controller.start).toHaveBeenCalledWith(
      expect.objectContaining({
        modelPath: path.resolve('/tmp/nexus-data/ai/models/codellama.gguf')
      })
    );
    expect(telemetry.track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ai.controller.start'
      })
    );
  });

  it('returns benchmark data with the current endpoint attached', async () => {
    const controller = {
      start: jest.fn(),
      stop: jest.fn(),
      getHealth: jest.fn().mockResolvedValue({
        status: 'running',
        installRoot: '/runtime/ai/llama.cpp',
        binaryPath: '/runtime/ai/llama.cpp/build/bin/llama-server',
        installed: true,
        endpoint: 'http://127.0.0.1:39281/health',
        host: '127.0.0.1',
        port: 39281,
        process: {
          pid: 1001,
          startedAt: Date.now(),
          restarts: 0,
          restartOnCrash: true
        },
        health: {
          ok: true,
          checkedAt: Date.now(),
          latencyMs: 8,
          statusCode: 200
        },
        configuration: {
          gpuPreference: 'auto',
          extraArgs: []
        },
        recentOutput: []
      }),
      benchmark: jest.fn().mockResolvedValue({
        iterations: 3,
        warmupIterations: 1,
        samples: [],
        summary: {
          successes: 3,
          failures: 0,
          avgLatencyMs: 11,
          p95LatencyMs: 14
        }
      })
    };
    const service = new LlamaControllerService(createMockEnv(), {
      controller,
      telemetry: {
        track: jest.fn()
      }
    });

    const result = await service.benchmark({
      iterations: 3
    });

    expect(result.endpoint).toBe('http://127.0.0.1:39281/health');
    expect(controller.benchmark).toHaveBeenCalledWith({
      iterations: 3
    });
  });
});
