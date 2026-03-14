import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { WorkbenchShell } from './workbench-shell';
import { WorkspaceStateService } from './workspace-state-service';

describe('WorkspaceStateService', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-workspace-service-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('persists editor and panel state changes', () => {
    const shell = new WorkbenchShell();
    const service = new WorkspaceStateService({
      workspaceId: 'spec',
      shell,
      dataRoot: tempDir,
      debounceMs: 0
    });

    shell.openEditor({ title: 'index.ts', resource: 'workspace://src/index.ts' });
    shell.openEditor({ title: 'README.md', resource: 'workspace://README.md', kind: 'preview' });
    shell.togglePanelVisibility(false);

    service.dispose();

    const restoreShell = new WorkbenchShell();
    const restoreService = new WorkspaceStateService({
      workspaceId: 'spec',
      shell: restoreShell,
      dataRoot: tempDir,
      debounceMs: 0
    });

    return restoreService.restore().then(restored => {
      expect(restored).toBe(true);
      const snapshot = restoreShell.layoutSnapshot();
      expect(snapshot.editors.groups[0]?.tabs.map(tab => tab.resource)).toEqual([
        'workspace://src/index.ts',
        'workspace://README.md'
      ]);
      expect(snapshot.panel.visible).toBe(false);
      restoreService.dispose();
    });
  });

  it('stores SCM metadata separately', () => {
    const shell = new WorkbenchShell();
    const service = new WorkspaceStateService({
      workspaceId: 'spec-scm',
      shell,
      dataRoot: tempDir,
      debounceMs: 0
    });

    service.updateScmState({ lastBranch: 'feature/docs' });
    service.dispose();
    const service2 = new WorkspaceStateService({
      workspaceId: 'spec-scm',
      shell: new WorkbenchShell(),
      dataRoot: tempDir,
      debounceMs: 0
    });
    return service2.restore().then(restored => {
      expect(restored).toBe(true);
      // Restore ensures the SCM payload has been read; the store retains it.
      service2.dispose();
      const stateFile = fs.readFileSync(path.join(tempDir, 'spec-scm.state.json'), 'utf8');
      expect(stateFile).toContain('feature/docs');
    });
  });
});
