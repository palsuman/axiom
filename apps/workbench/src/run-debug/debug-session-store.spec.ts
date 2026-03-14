import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  DebugEvaluatePayload,
  DebugSessionEvent,
  DebugSessionSnapshot,
  DebugSessionStartPayload,
  DebugSessionStopPayload,
  DebugSessionStopResponse
} from '@nexus/contracts/ipc';

import { DebugSessionStore } from './debug-session-store';

describe('DebugSessionStore', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-debug-session-store-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

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
      debugStart: jest.fn(async (payload: DebugSessionStartPayload) => {
        void payload;
        return session;
      }),
      debugStop: jest.fn(async (payload: DebugSessionStopPayload): Promise<DebugSessionStopResponse> => {
        void payload;
        return {
        sessionId: session.sessionId,
        stopped: true,
        state: 'terminated'
        };
      }),
      debugEvaluate: jest.fn(async (payload: DebugEvaluatePayload) => ({
        sessionId: payload.sessionId ?? session.sessionId,
        frameId: payload.frameId,
        expression: payload.expression,
        result: payload.frameId ? `${payload.expression}:${payload.frameId}` : payload.expression,
        type: 'string'
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

  it('starts sessions with persisted enabled breakpoints', async () => {
    const bridge = createBridge();
    const store = new DebugSessionStore({
      bridge,
      workspaceId: 'spec-workspace',
      dataRoot: tempDir
    });

    store.addBreakpoint('/workspace/server.js', 12);
    store.addBreakpoint('/workspace/server.js', 18);
    store.addBreakpoint('/workspace/worker.js', 4);
    const disabled = store.getSnapshot().breakpoints.find(breakpoint => breakpoint.source === '/workspace/worker.js');
    expect(disabled).toBeDefined();
    store.toggleBreakpoint(disabled!.id, false);

    await store.start({ configurationName: 'Launch API' });

    expect(bridge.debugStart).toHaveBeenCalledWith({
      configurationName: 'Launch API',
      breakpoints: [
        {
          source: '/workspace/server.js',
          lines: [12, 18]
        }
      ]
    });
  });

  it('persists breakpoints and watch expressions across workspace restarts', async () => {
    const bridge = createBridge();
    const store = new DebugSessionStore({
      bridge,
      workspaceId: 'persisted-workspace',
      dataRoot: tempDir
    });

    store.addBreakpoint('/workspace/server.js', 9);
    store.addWatchExpression('process.pid');

    const restored = new DebugSessionStore({
      bridge: createBridge(),
      workspaceId: 'persisted-workspace',
      dataRoot: tempDir
    });

    expect(restored.getSnapshot().breakpoints).toEqual([
      expect.objectContaining({
        source: '/workspace/server.js',
        line: 9,
        enabled: true
      })
    ]);
    expect(restored.getSnapshot().watchExpressions).toEqual([
      expect.objectContaining({
        expression: 'process.pid',
        status: 'idle'
      })
    ]);
  });

  it('evaluates watches for the selected stopped frame and refreshes on frame selection', async () => {
    const bridge = createBridge();
    const store = new DebugSessionStore({
      bridge,
      workspaceId: 'watch-workspace',
      dataRoot: tempDir
    });

    store.addWatchExpression('process.pid');
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
          },
          {
            id: 2,
            name: 'handler',
            source: {
              path: '/workspace/server.js',
              name: 'server.js'
            },
            line: 18,
            column: 3
          }
        ]
      }
    });

    await flushPromises();

    expect(store.getSnapshot().selectedStackFrameId).toBe(1);
    expect(store.getSnapshot().watchExpressions[0]).toEqual(
      expect.objectContaining({
        expression: 'process.pid',
        value: 'process.pid:1',
        status: 'evaluated'
      })
    );

    store.selectStackFrame(2);
    await flushPromises();

    expect(bridge.debugEvaluate).toHaveBeenLastCalledWith({
      sessionId: 'debug-1',
      frameId: 2,
      expression: 'process.pid',
      context: 'watch'
    });
    expect(store.getSnapshot().watchExpressions[0]).toEqual(
      expect.objectContaining({
        value: 'process.pid:2',
        status: 'evaluated'
      })
    );
  });

  it('tracks output and stop operations', async () => {
    const bridge = createBridge();
    const store = new DebugSessionStore({
      bridge,
      workspaceId: 'stop-workspace',
      dataRoot: tempDir
    });

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
    expect(store.getSnapshot().watchExpressions).toEqual([]);
  });

  it('surfaces bridge errors on start failure', async () => {
    const bridge = createBridge();
    bridge.debugStart.mockRejectedValue(new Error('adapter unavailable'));
    const store = new DebugSessionStore({
      bridge,
      workspaceId: 'error-workspace',
      dataRoot: tempDir
    });

    await expect(store.start()).rejects.toThrow('adapter unavailable');
    expect(store.getSnapshot().error).toBe('adapter unavailable');
  });
});

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}
