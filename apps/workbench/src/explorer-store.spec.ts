import type { WorkspaceDescriptor } from '@nexus/platform/workspace-descriptor';
import type { WorkspaceWatchEvent } from '@nexus/platform/workspace-watcher';
import { ExplorerStore, type ExplorerDirectoryEntry, type ExplorerDataProvider } from './explorer-store';

class MockExplorerProvider implements ExplorerDataProvider {
  readonly calls: string[] = [];
  constructor(private readonly map: Record<string, ExplorerDirectoryEntry[]>) {}
  async readDirectory(path: string) {
    this.calls.push(path);
    return this.map[path] ?? [];
  }
}

function createDescriptor(path: string): WorkspaceDescriptor {
  return {
    primary: path,
    roots: [path],
    label: path.split('/').pop() ?? path,
    folders: [{ path, name: path.split('/').pop() ?? path }]
  };
}

describe('ExplorerStore', () => {
  it('bootstraps descriptor and auto-expands single root', async () => {
    const provider = new MockExplorerProvider({
      '/repo': [
        { path: '/repo/src', kind: 'folder', name: 'src' },
        { path: '/repo/README.md', kind: 'file', name: 'README.md' }
      ]
    });
    const store = new ExplorerStore(provider, { autoExpandSingleRoot: true });
    await store.initialize(createDescriptor('/repo'));
    const snapshot = store.getSnapshot();
    expect(snapshot.nodes.length).toBeGreaterThan(1);
    expect(snapshot.nodes[0].name).toBe('repo');
    expect(snapshot.nodes[1].name).toBe('src');
    expect(snapshot.pendingPaths.length).toBe(0);
  });

  it('loads folder contents lazily and caches results', async () => {
    const provider = new MockExplorerProvider({
      '/repo': [{ path: '/repo/src', kind: 'folder', name: 'src' }],
      '/repo/src': [{ path: '/repo/src/index.ts', kind: 'file', name: 'index.ts' }]
    });
    const store = new ExplorerStore(provider, { autoExpandSingleRoot: true });
    await store.initialize(createDescriptor('/repo'));
    await store.expand('/repo/src');
    let snapshot = store.getSnapshot();
    expect(snapshot.nodes.some(node => node.name === 'index.ts')).toBe(true);
    await store.expand('/repo/src');
    expect(provider.calls.filter(path => path === '/repo/src').length).toBe(1);
    store.collapse('/repo/src');
    snapshot = store.getSnapshot();
    expect(snapshot.nodes.some(node => node.name === 'index.ts')).toBe(false);
  });

  it('applies workspace events to keep tree in sync', async () => {
    const provider = new MockExplorerProvider({ '/repo': [] });
    const store = new ExplorerStore(provider, { autoExpandSingleRoot: true });
    await store.initialize(createDescriptor('/repo'));
    const event: WorkspaceWatchEvent = {
      type: 'add',
      root: '/repo',
      absolutePath: '/repo/hello.txt',
      relativePath: 'hello.txt'
    };
    await store.handleWorkspaceEvent(event);
    const snapshot = store.getSnapshot();
    expect(snapshot.nodes.some(node => node.name === 'hello.txt')).toBe(true);
  });

  it('virtualizes visible nodes for large directories', async () => {
    const largeSet: ExplorerDirectoryEntry[] = Array.from({ length: 200 }).map((_, index) => ({
      path: `/repo/file-${index}.ts`,
      kind: 'file',
      name: `file-${index}.ts`
    }));
    const provider = new MockExplorerProvider({ '/repo': largeSet });
    const store = new ExplorerStore(provider, { autoExpandSingleRoot: true, rowHeight: 20 });
    await store.initialize(createDescriptor('/repo'));
    store.updateViewport(0, 100);
    const snapshot = store.getSnapshot();
    expect(snapshot.virtualSlice.total).toBeGreaterThan(150);
    expect(snapshot.virtualSlice.items.length).toBeLessThanOrEqual(7);
    store.updateViewport(400, 100);
    const moved = store.getSnapshot();
    expect(moved.virtualSlice.startIndex).toBeGreaterThan(0);
  });

  it('tracks optimistic path state', async () => {
    const provider = new MockExplorerProvider({ '/repo': [] });
    const store = new ExplorerStore(provider, { autoExpandSingleRoot: true, caseSensitive: true });
    await store.initialize(createDescriptor('/repo'));
    store.addOptimisticPaths(['/repo/new-file.ts']);
    expect(store.getSnapshot().pendingPaths).toContain('/repo/new-file.ts');
    store.clearOptimisticPaths(['/repo/new-file.ts']);
    expect(store.getSnapshot().pendingPaths).not.toContain('/repo/new-file.ts');
  });
});
