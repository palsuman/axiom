import {
  ExplorerTreeModel,
  TreeVirtualizer,
  type ExplorerNodeView,
  type VirtualizedSlice,
  normalizeExplorerPath
} from '@nexus/platform/explorer-tree';
import type { WorkspaceDescriptor } from '@nexus/platform/workspace-descriptor';
import type { WorkspaceWatchEvent } from '@nexus/platform/workspace-watcher';

export type ExplorerDirectoryEntry = {
  path: string;
  name?: string;
  kind: 'file' | 'folder';
};

export interface ExplorerDataProvider {
  readDirectory(path: string): Promise<ExplorerDirectoryEntry[]>;
}

export interface ExplorerStoreOptions {
  rowHeight?: number;
  autoExpandSingleRoot?: boolean;
  caseSensitive?: boolean;
}

export interface ExplorerSnapshot {
  readonly descriptor?: WorkspaceDescriptor;
  readonly nodes: readonly ExplorerNodeView[];
  readonly virtualSlice: VirtualizedSlice<ExplorerNodeView>;
  readonly pendingPaths: readonly string[];
  readonly lastUpdated: number;
  readonly errors: readonly { path: string; message: string }[];
}

type SnapshotListener = (snapshot: ExplorerSnapshot) => void;

export class ExplorerStore {
  private readonly tree: ExplorerTreeModel;
  private readonly virtualizer: TreeVirtualizer<ExplorerNodeView>;
  private readonly listeners = new Set<SnapshotListener>();
  private readonly loadedDirectories = new Set<string>();
  private readonly inflightLoads = new Map<string, Promise<void>>();
  private readonly errors = new Map<string, Error>();
  private readonly optimisticPaths = new Set<string>();
  private descriptor?: WorkspaceDescriptor;
  private viewportHeight = 400;
  private scrollTop = 0;
  private snapshot: ExplorerSnapshot;

  constructor(private readonly provider: ExplorerDataProvider, private readonly options: ExplorerStoreOptions = {}) {
    if (!provider) {
      throw new Error('ExplorerStore requires an ExplorerDataProvider instance');
    }
    this.tree = new ExplorerTreeModel({ caseSensitive: options.caseSensitive });
    this.virtualizer = new TreeVirtualizer(options.rowHeight ?? 22);
    this.snapshot = {
      nodes: [],
      virtualSlice: this.virtualizer.compute([], 0, this.viewportHeight),
      pendingPaths: [],
      errors: [],
      lastUpdated: Date.now()
    };
  }

  async initialize(descriptor: WorkspaceDescriptor) {
    this.descriptor = descriptor;
    this.tree.loadFromDescriptor(descriptor);
    this.loadedDirectories.clear();
    this.inflightLoads.clear();
    this.errors.clear();
    this.scrollTop = 0;
    this.refreshSnapshot();
    if (this.options.autoExpandSingleRoot !== false && descriptor.folders.length === 1) {
      await this.expand(descriptor.folders[0].path);
    }
  }

  async expand(path: string) {
    this.tree.toggleExpanded(path, true);
    this.refreshSnapshot();
    await this.loadChildren(path);
  }

  collapse(path: string) {
    this.tree.toggleExpanded(path, false);
    this.refreshSnapshot();
  }

  toggle(path: string) {
    const visible = this.tree.getVisibleNodes();
    const node = visible.find(item => item.path === this.normalize(path));
    if (!node || node.kind !== 'folder') {
      return;
    }
    if (node.isExpanded) {
      this.collapse(path);
    } else {
      void this.expand(path);
    }
  }

  async handleWorkspaceEvent(event: WorkspaceWatchEvent) {
    this.tree.applyWorkspaceEvent(event);
    if (event.type === 'addDir') {
      const normalized = this.normalize(event.absolutePath);
      this.loadedDirectories.delete(normalized);
    }
    this.refreshSnapshot();
  }

  updateViewport(scrollTop: number, viewportHeight: number) {
    this.scrollTop = Math.max(0, scrollTop);
    this.viewportHeight = Math.max(1, viewportHeight);
    this.refreshSnapshot();
  }

  getSnapshot(): ExplorerSnapshot {
    return this.snapshot;
  }

  onDidChange(listener: SnapshotListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose() {
    this.listeners.clear();
    this.inflightLoads.clear();
    this.loadedDirectories.clear();
    this.errors.clear();
    this.optimisticPaths.clear();
  }

  addOptimisticPaths(paths: readonly string[]) {
    let changed = false;
    paths.forEach(pathValue => {
      const normalized = this.normalize(pathValue);
      if (!this.optimisticPaths.has(normalized)) {
        this.optimisticPaths.add(normalized);
        changed = true;
      }
    });
    if (changed) {
      this.refreshSnapshot();
    }
  }

  clearOptimisticPaths(paths: readonly string[]) {
    let changed = false;
    paths.forEach(pathValue => {
      const normalized = this.normalize(pathValue);
      if (this.optimisticPaths.delete(normalized)) {
        changed = true;
      }
    });
    if (changed) {
      this.refreshSnapshot();
    }
  }

  private async loadChildren(path: string) {
    const normalized = this.normalize(path);
    if (this.loadedDirectories.has(normalized)) {
      return;
    }
    const existing = this.inflightLoads.get(normalized);
    if (existing) {
      return existing;
    }
    const loadPromise = this.provider
      .readDirectory(path)
      .then(entries => {
        entries.forEach(entry => {
          this.tree.upsertNode({
            path: entry.path,
            name: entry.name,
            kind: entry.kind,
            parentPath: path
          });
        });
        this.loadedDirectories.add(normalized);
        this.errors.delete(normalized);
      })
      .catch(error => {
        const err = error instanceof Error ? error : new Error(String(error));
        this.errors.set(normalized, err);
      })
      .finally(() => {
        this.inflightLoads.delete(normalized);
        this.refreshSnapshot();
      });
    this.inflightLoads.set(normalized, loadPromise);
    this.refreshSnapshot();
    return loadPromise;
  }

  private refreshSnapshot() {
    const nodes = this.tree.getVisibleNodes();
    const slice = this.virtualizer.compute(nodes, this.scrollTop, this.viewportHeight);
    const pendingSet = new Set<string>([...this.inflightLoads.keys(), ...this.optimisticPaths]);
    this.snapshot = {
      descriptor: this.descriptor,
      nodes,
      virtualSlice: slice,
      pendingPaths: Array.from(pendingSet),
      errors: Array.from(this.errors.entries()).map(([path, error]) => ({ path, message: error.message })),
      lastUpdated: Date.now()
    };
    this.listeners.forEach(listener => listener(this.snapshot));
  }

  private normalize(path: string) {
    return normalizeExplorerPath(path, this.options.caseSensitive);
  }
}
