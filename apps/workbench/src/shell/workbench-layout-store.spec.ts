import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WorkbenchShell } from './workbench-shell';
import { WorkbenchLayoutStore, bootstrapPersistentWorkbenchShell } from './workbench-layout-store';

describe('WorkbenchLayoutStore', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-layout-store-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('persists and restores layout state with sanitized filenames', () => {
    const store = new WorkbenchLayoutStore({ workspaceId: '/Users/dev/My Workspace', dataRoot: tempDir });
    const shell = new WorkbenchShell();
    shell.setSidebarSize(420);
    shell.togglePanelVisibility(false);
    store.saveSnapshot(shell.layoutSnapshot());
    const restored = store.loadState();
    expect(restored?.sidebar.size).toBe(420);
    expect(restored?.panel.visible).toBe(false);
    const persistedFiles = fs.readdirSync(tempDir);
    expect(persistedFiles.some(name => name.includes('my-workspace'))).toBe(true);
  });

  it('bootstrap helper wires persistence listeners', () => {
    const handle = bootstrapPersistentWorkbenchShell({ workspaceId: 'project-alpha', dataRoot: tempDir });
    handle.shell.setPanelPosition('right');
    handle.shell.setPanelSize(360);
    handle.shell.togglePanelVisibility(true);
    handle.dispose();
    const snapshot = handle.store.loadState();
    expect(snapshot?.panel.position).toBe('right');
    expect(snapshot?.panel.size).toBe(360);
  });
});
