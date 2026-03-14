import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WorkspaceHistoryStore } from './workspace-history';

describe('WorkspaceHistoryStore', () => {
  it('records and lists workspaces with deduplication', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-history-'));
    const store = new WorkspaceHistoryStore({ historyDir: tmpDir, limit: 3 });
    const first = store.record({ path: '/tmp/project-one', roots: ['/tmp/project-one'] });
    expect(first.label).toBe('project-one');
    store.record({ path: '/tmp/project-two' });
    store.record({ path: '/tmp/project-three' });
    store.record({ path: '/tmp/project-one', descriptorPath: '/tmp/project-one/workspace.nexus-workspace.json', label: 'Workspace One' });
    const entries = store.list();
    expect(entries.length).toBe(3);
    expect(entries[0].path).toBe(path.resolve('/tmp/project-one/workspace.nexus-workspace.json'));
    expect(entries[0].descriptorPath).toBe(path.resolve('/tmp/project-one/workspace.nexus-workspace.json'));
  });
});
