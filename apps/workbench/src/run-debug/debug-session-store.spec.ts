import type {
  DebugSessionEvent,
  DebugSessionSnapshot,
  DebugSessionStartPayload,
  DebugSessionStopPayload,
  DebugSessionStopResponse
} from '@nexus/contracts/ipc';

import { DebugSessionStore } from './debug-session-store';

describe('DebugSessionStore', () => {
  function createBridge() {
    const listeners = new Set<(event: DebugSessionEvent) => void>();

    const session: DebugSessionSnapshot = {
      sessionId: 'debug-1',
      workspaceSessionId: 'workspace-1',
      ownerWebContentsId: 1,
      configurationName: 'Launch API',
      adapterType: 'node',
      request: 'launch',
      startedAt: Date.now(),
      state: 'running',
      stackFrames: []
    };

    return {
      debugStart: jest.fn(async (_payload: DebugSessionStartPayload) => session),
      debugStop: jest.fn(async (_payload: DebugSessionStopPayload): Promise<DebugSessionStopResponse> => ({
        sessionId: session.sessionId,
        stopped: true,
        state: 'terminated'
      })),
      onDebugEvent: jest.fn((listener: (event: DebugSessionEvent) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }),
      emit(event: DebugSessionEvent) {
        listeners.forEach(listener => listener(event));
      }
    };
  }

  it('starts sessions and reflects event-driven snapshot updates', async () => {
    const bridge = createBridge();
    const store = new DebugSessionStore(bridge);

    await store.start({ configurationName: 'Launch API' });

    bridge.emit({
      sessionId: 'debug-1',
      kind: 'stopped',
      timestamp: Date.now(),
      snapshot: {
        ...store.getSnapshot().session!,
        state: 'stopped',
        reason: 'breakpoint',
        stackFrames: [
          {
            id: 1,
            name: 'main',
            source: {
              path: '/workspace/server.js',
              name: 'server.js'
            },
            line: 12,
            column: 1
          }
        ]
      }
    });

    const snapshot = store.getSnapshot();

    expect(snapshot.session?.state).toBe('stopped');
    expect(snapshot.session?.stackFrames[0]?.line).toBe(12);
    expect(snapshot.error).toBeUndefined();
  });

  it('tracks output and stop operations', async () => {
    const bridge = createBridge();
    const store = new DebugSessionStore(bridge);

    await store.start();

    bridge.emit({
      sessionId: 'debug-1',
      kind: 'output',
      timestamp: Date.now(),
      output: {
        category: 'stdout',
        output: 'server listening\n'
      }
    });

    const result = await store.stop({ sessionId: 'debug-1' });

    expect(result.stopped).toBe(true);
    expect(store.getSnapshot().output.at(-1)).toBe('server listening\n');
    expect(bridge.debugStop).toHaveBeenCalledWith({ sessionId: 'debug-1' });
  });

  it('surfaces bridge errors on start failure', async () => {
    const bridge = createBridge();
    bridge.debugStart.mockRejectedValue(new Error('adapter unavailable'));
    const store = new DebugSessionStore(bridge);

    await expect(store.start()).rejects.toThrow('adapter unavailable');
    expect(store.getSnapshot().error).toBe('adapter unavailable');
  });
});
