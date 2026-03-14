import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { WorkspaceStateStore } from './workspace-state-store';

describe('WorkspaceStateStore', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-workspace-state-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('saves and loads workspace state payloads', () => {
    const store = new WorkspaceStateStore({ workspaceId: 'Spec Workspace', dataRoot: tempDir });
    const payload = {
      editors: [
        { resource: 'workspace://src/app.ts', title: 'app.ts', kind: 'text' as const, groupId: 'group-1' },
        { resource: 'workspace://README.md', title: 'README.md', kind: 'preview' as const }
      ],
      activeEditorResource: 'workspace://src/app.ts',
      activityBar: { activeId: 'activity.git' },
      sidebar: { activeViewId: 'view.explorer' },
      panel: { activeViewId: 'panel.terminal', visible: true },
      scm: { lastBranch: 'feature/state' }
    };

    store.save(payload);
    const loaded = store.load();
    expect(loaded).toEqual(payload);
  });

  it('returns null when no state file exists', () => {
    const store = new WorkspaceStateStore({ workspaceId: 'unknown', dataRoot: tempDir });
    expect(store.load()).toBeNull();
  });
});
