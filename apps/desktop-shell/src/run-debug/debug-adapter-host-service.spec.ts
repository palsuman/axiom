import EventEmitter from 'node:events';

import type { DebugProtocolEvent, DebugProtocolResponse } from '@nexus/platform/run-debug/debug-adapter-protocol';

import { DebugAdapterHostService } from './debug-adapter-host-service';

type MockWindowManager = {
  getSessionMetadataForWebContents: jest.Mock;
};

type MockLaunchConfigurationService = {
  load: jest.Mock;
};

class FakeDebugAdapterClient extends EventEmitter {
  readonly requests: Array<{ command: string; args?: Record<string, unknown> }> = [];
  private readonly responses = new Map<string, DebugProtocolResponse>();

  constructor() {
    super();
    this.responses.set('initialize', okResponse('initialize'));
    this.responses.set('launch', okResponse('launch'));
    this.responses.set('attach', okResponse('attach'));
    this.responses.set('configurationDone', okResponse('configurationDone'));
    this.responses.set('setBreakpoints', okResponse('setBreakpoints', { breakpoints: [{ verified: true, line: 12 }] }));
    this.responses.set('disconnect', okResponse('disconnect'));
    this.responses.set('threads', okResponse('threads', { threads: [{ id: 1, name: 'Main Thread' }] }));
    this.responses.set(
      'stackTrace',
      okResponse('stackTrace', {
        stackFrames: [
          {
            id: 1,
            name: 'main',
            source: { path: '/workspace/server.js', name: 'server.js' },
            line: 12,
            column: 1
          }
        ]
      })
    );
  }

  async start() {
    return undefined;
  }

  async request(command: string, args?: Record<string, unknown>) {
    this.requests.push({ command, args });
    const response = this.responses.get(command);
    if (!response) {
      throw new Error(`Missing fake response for ${command}`);
    }
    return response;
  }

  dispose() {
    this.removeAllListeners();
  }

  emitAdapterEvent(event: DebugProtocolEvent) {
    this.emit('event', event);
  }
}

describe('DebugAdapterHostService', () => {
  let windows: MockWindowManager;
  let launchConfigurations: MockLaunchConfigurationService;
  let clients: FakeDebugAdapterClient[];

  beforeEach(() => {
    windows = {
      getSessionMetadataForWebContents: jest.fn(() => ({
        id: 'workspace-session-1',
        workspace: '/workspace',
        workspacePrimary: '/workspace',
        workspaceRoots: ['/workspace'],
        lastOpenedAt: 1,
        lastFocusedAt: 1
      }))
    };

    launchConfigurations = {
      load: jest.fn().mockResolvedValue({
        path: '/workspace/.nexus/launch.json',
        exists: true,
        text: JSON.stringify(
          {
            version: '1.0.0',
            configurations: [
              {
                name: 'Launch API',
                type: 'node',
                request: 'launch',
                program: 'server.js',
                cwd: '/workspace',
                args: ['--port', '3000']
              }
            ]
          },
          null,
          2
        ),
        issues: []
      })
    };

    clients = [];
  });

  it('starts debug sessions and emits stopped events with stack frames', async () => {
    const host = new DebugAdapterHostService(windows as never, launchConfigurations as never, {
      adapterResolver: () => ({ command: 'fake-adapter' }),
      clientFactory: () => {
        const client = new FakeDebugAdapterClient();
        clients.push(client);
        return client as never;
      },
      now: () => 1700000000000
    });

    const events: string[] = [];
    const snapshots: Array<string | undefined> = [];
    host.on('event', payload => {
      events.push(payload.event.kind);
      snapshots.push(payload.event.snapshot?.state);
    });

    const snapshot = await host.start(
      { id: 42 } as never,
      {
        configurationName: 'Launch API',
        breakpoints: [{ source: '/workspace/server.js', lines: [12] }]
      }
    );

    expect(snapshot.state).toBe('running');
    expect(clients[0]?.requests.map(request => request.command)).toEqual([
      'initialize',
      'setBreakpoints',
      'launch',
      'configurationDone'
    ]);

    clients[0]?.emitAdapterEvent({
      seq: 9,
      type: 'event',
      event: 'stopped',
      body: {
        reason: 'breakpoint',
        threadId: 1
      }
    });

    await flushAsync();

    expect(events).toContain('started');
    expect(events).toContain('stopped');
    expect(snapshots).toContain('stopped');
  });

  it('stops the active session for a renderer', async () => {
    const host = new DebugAdapterHostService(windows as never, launchConfigurations as never, {
      adapterResolver: () => ({ command: 'fake-adapter' }),
      clientFactory: () => {
        const client = new FakeDebugAdapterClient();
        clients.push(client);
        return client as never;
      }
    });

    const started = await host.start({ id: 7 } as never, {});
    const result = await host.stop(
      { id: 7 } as never,
      {
        sessionId: started.sessionId,
        terminateDebuggee: true
      }
    );

    expect(result).toEqual({
      sessionId: started.sessionId,
      stopped: true,
      state: 'terminated'
    });
    expect(clients[0]?.requests.some(request => request.command === 'disconnect')).toBe(true);
  });

  it('fails when launch configurations are invalid', async () => {
    launchConfigurations.load.mockResolvedValue({
      path: '/workspace/.nexus/launch.json',
      exists: true,
      text: '{',
      issues: []
    });

    const host = new DebugAdapterHostService(windows as never, launchConfigurations as never, {
      adapterResolver: () => ({ command: 'fake-adapter' }),
      clientFactory: () => new FakeDebugAdapterClient() as never
    });

    await expect(host.start({ id: 1 } as never, {})).rejects.toThrow(/Launch configuration validation failed/);
  });
});

function okResponse(command: string, body: Record<string, unknown> = {}): DebugProtocolResponse {
  return {
    seq: 1,
    type: 'response',
    request_seq: 1,
    success: true,
    command,
    body
  };
}

async function flushAsync() {
  await Promise.resolve();
  await new Promise(resolve => setImmediate(resolve));
}
