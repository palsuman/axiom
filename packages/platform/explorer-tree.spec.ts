import type { WorkspaceWatchEvent } from './workspace-watcher';
import {
  ExplorerTreeModel,
  TreeVirtualizer,
  createDescriptorFromFolders,
  normalizeExplorerPath
} from './explorer-tree';

describe('ExplorerTreeModel', () => {
  it('loads descriptors and exposes visible nodes ordered by name', () => {
    const model = new ExplorerTreeModel();
    model.loadFromDescriptor(
      createDescriptorFromFolders([
        { path: '/repo/zeta', name: 'zeta' },
        { path: '/repo/alpha', name: 'alpha' }
      ])
    );
    const visible = model.getVisibleNodes();
    expect(visible.map(node => node.name)).toEqual(['alpha', 'zeta']);
  });

  it('upserts children and toggles expansion state', () => {
    const model = new ExplorerTreeModel();
    const descriptor = createDescriptorFromFolders([{ path: '/repo', name: 'repo' }]);
    model.loadFromDescriptor(descriptor);
    model.upsertNode({ path: '/repo/src', parentPath: '/repo', kind: 'folder' });
    model.upsertNode({ path: '/repo/README.md', parentPath: '/repo', kind: 'file' });
    model.toggleExpanded('/repo', true);
    const visible = model.getVisibleNodes();
    expect(visible.length).toBe(3);
    expect(visible[1].name).toBe('src');
    expect(visible[2].name).toBe('readme.md');
  });

  it('applies workspace events for add/update/remove', () => {
    const model = new ExplorerTreeModel();
    const descriptor = createDescriptorFromFolders([{ path: '/repo', name: 'repo' }]);
    model.loadFromDescriptor(descriptor);
    const events: WorkspaceWatchEvent[] = [
      { type: 'addDir', root: '/repo', absolutePath: '/repo/src', relativePath: 'src' },
      { type: 'add', root: '/repo', absolutePath: '/repo/src/index.ts', relativePath: 'src/index.ts' },
      { type: 'change', root: '/repo', absolutePath: '/repo/src/index.ts', relativePath: 'src/index.ts' },
      { type: 'unlink', root: '/repo', absolutePath: '/repo/src/index.ts', relativePath: 'src/index.ts' },
      { type: 'unlinkDir', root: '/repo', absolutePath: '/repo/src', relativePath: 'src' }
    ];
    events.forEach(event => model.applyWorkspaceEvent(event));
    const visible = model.getVisibleNodes();
    expect(visible.map(node => node.path)).toEqual(['/repo']);
  });
});

describe('TreeVirtualizer', () => {
  it('computes slices respecting viewport height', () => {
    const items = Array.from({ length: 200 }).map((_, index) => ({ id: index }));
    const virtualizer = new TreeVirtualizer<{ id: number }>(24);
    const slice = virtualizer.compute(items, 240, 120);
    expect(slice.startIndex).toBeGreaterThan(0);
    expect(slice.items.length).toBeLessThanOrEqual(7);
    expect(slice.total).toBe(200);
    expect(slice.height).toBe(200 * 24);
  });
});

describe('normalizeExplorerPath', () => {
  it('normalizes case, separators, and trailing slashes', () => {
    expect(normalizeExplorerPath('C\\Repo//src/')).toBe('c/repo/src');
    expect(normalizeExplorerPath('/Users/Dev/Work/', true)).toBe('/Users/Dev/Work');
  });
});
