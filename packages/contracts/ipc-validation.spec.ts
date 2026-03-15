import { IpcValidationError, validateIpcPayload } from './ipc-validation';

describe('ipc-validation', () => {
  it('validates log payloads and normalizes strings', () => {
    const payload = validateIpcPayload('nexus:log', {
      level: 'info',
      message: '  hello world  '
    });

    expect(payload).toEqual({
      level: 'info',
      message: 'hello world'
    });
  });

  it('rejects malformed git stage payloads', () => {
    expect(() =>
      validateIpcPayload('nexus:git:stage', {
        repositoryId: '',
        paths: []
      })
    ).toThrow(IpcValidationError);
  });

  it('validates terminal creation payloads with env records', () => {
    const payload = validateIpcPayload('nexus:terminal:create', {
      cols: 120,
      rows: 40,
      cwd: '/tmp/workspace',
      shell: '/bin/zsh',
      env: {
        NODE_ENV: 'test'
      }
    });

    expect(payload).toEqual({
      cols: 120,
      rows: 40,
      cwd: '/tmp/workspace',
      shell: '/bin/zsh',
      env: {
        NODE_ENV: 'test'
      },
      sessionId: undefined
    });
  });

  it('validates telemetry payloads with attributes and measurements', () => {
    const payload = validateIpcPayload('nexus:telemetry:track', {
      name: 'workbench.started',
      scope: 'renderer',
      level: 'info',
      attributes: {
        locale: 'en-US',
        trusted: true,
        retries: 0,
        note: null
      },
      measurements: {
        startupMs: 123
      },
      tags: ['bootstrap', 'shell'],
      timestamp: 123456
    });

    expect(payload).toEqual({
      name: 'workbench.started',
      scope: 'renderer',
      level: 'info',
      message: undefined,
      attributes: {
        locale: 'en-US',
        trusted: true,
        retries: 0,
        note: null
      },
      measurements: {
        startupMs: 123
      },
      tags: ['bootstrap', 'shell'],
      timestamp: 123456,
      sessionId: undefined,
      workspaceId: undefined
    });
  });

  it('validates llama.cpp controller start payloads', () => {
    const payload = validateIpcPayload('nexus:ai:controller:start', {
      modelPath: '/models/coder.gguf',
      host: '127.0.0.1',
      port: 39281,
      threads: 8,
      contextSize: 8192,
      batchSize: 256,
      gpuPreference: 'gpu',
      gpuLayers: 20,
      restartOnCrash: true,
      extraArgs: ['--verbose']
    });

    expect(payload).toEqual({
      modelPath: '/models/coder.gguf',
      host: '127.0.0.1',
      port: 39281,
      threads: 8,
      contextSize: 8192,
      batchSize: 256,
      gpuPreference: 'gpu',
      gpuLayers: 20,
      restartOnCrash: true,
      extraArgs: ['--verbose']
    });
  });

  it('rejects malformed llama.cpp controller benchmark payloads', () => {
    expect(() =>
      validateIpcPayload('nexus:ai:controller:benchmark', {
        iterations: 0,
        warmupIterations: -1
      })
    ).toThrow(IpcValidationError);
  });

  it('rejects invalid telemetry attributes', () => {
    expect(() =>
      validateIpcPayload('nexus:telemetry:track', {
        name: 'bad.event',
        scope: 'renderer',
        attributes: {
          nested: { nope: true }
        }
      })
    ).toThrow(/attributes\.nested/);
  });

  it('rejects invalid workspace backup payloads deeply', () => {
    expect(() =>
      validateIpcPayload('nexus:workspace-backup:save', {
        workspaceId: 'workspace-1',
        snapshot: {
          documents: [{ uri: '', value: 'x', dirty: true }],
          terminals: [],
          runConfigs: []
        }
      })
    ).toThrow(/documents\[0\]\.uri/);
  });

  it('validates file operation payloads', () => {
    const payload = validateIpcPayload('nexus:fs:move', {
      entries: [
        {
          source: '/tmp/a.txt',
          target: '/tmp/b.txt'
        }
      ],
      overwrite: true
    });

    expect(payload).toEqual({
      entries: [
        {
          source: '/tmp/a.txt',
          target: '/tmp/b.txt'
        }
      ],
      overwrite: true
    });
  });

  it('validates debug start payloads with optional breakpoints', () => {
    const payload = validateIpcPayload('nexus:debug:start', {
      configurationName: 'Launch API',
      stopOnEntry: true,
      breakpoints: [
        {
          source: '/workspace/server.js',
          lines: [12, 20]
        }
      ]
    });

    expect(payload).toEqual({
      configurationName: 'Launch API',
      configurationIndex: undefined,
      stopOnEntry: true,
      breakpoints: [
        {
          source: '/workspace/server.js',
          lines: [12, 20]
        }
      ]
    });
  });

  it('rejects malformed debug stop payloads', () => {
    expect(() =>
      validateIpcPayload('nexus:debug:stop', {
        sessionId: '',
        terminateDebuggee: 'yes'
      })
    ).toThrow(IpcValidationError);
  });

  it('validates debug evaluate payloads', () => {
    const payload = validateIpcPayload('nexus:debug:evaluate', {
      sessionId: 'debug-1',
      frameId: 1,
      expression: 'process.pid',
      context: 'watch'
    });

    expect(payload).toEqual({
      sessionId: 'debug-1',
      frameId: 1,
      expression: 'process.pid',
      context: 'watch'
    });
  });

  it('validates privacy consent update payloads', () => {
    const payload = validateIpcPayload('nexus:privacy:update-consent', {
      scope: 'workspace',
      workspaceId: 'workspace-1',
      preferences: {
        usageTelemetry: false,
        crashReports: true
      }
    });

    expect(payload).toEqual({
      scope: 'workspace',
      workspaceId: 'workspace-1',
      preferences: {
        usageTelemetry: false,
        crashReports: true
      }
    });
  });

  it('rejects malformed privacy export payloads', () => {
    expect(() =>
      validateIpcPayload('nexus:privacy:export-data', {
        workspaceId: '',
        mode: 'everything'
      })
    ).toThrow(IpcValidationError);
  });
});
