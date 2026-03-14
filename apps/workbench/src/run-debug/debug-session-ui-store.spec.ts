import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DebugSessionUiStore } from './debug-session-ui-store';

describe('DebugSessionUiStore', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-debug-ui-state-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('saves and loads breakpoint and watch state', () => {
    const store = new DebugSessionUiStore({ workspaceId: 'Spec Workspace', dataRoot: tempDir });
    store.save({
      breakpoints: [
        {
          id: 'bp-1',
          source: '/workspace/server.js',
          line: 12,
          enabled: true
        }
      ],
      watchExpressions: [
        {
          id: 'watch-1',
          expression: 'process.pid',
          value: '12345',
          type: 'number',
          status: 'evaluated'
        }
      ],
      selectedStackFrameId: 1
    });

    expect(store.load()).toEqual({
      breakpoints: [
        {
          id: 'bp-1',
          source: '/workspace/server.js',
          line: 12,
          enabled: true
        }
      ],
      watchExpressions: [
        {
          id: 'watch-1',
          expression: 'process.pid',
          value: '12345',
          type: 'number',
          status: 'evaluated'
        }
      ],
      selectedStackFrameId: 1
    });
  });
});
