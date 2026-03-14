import type { WorkspaceDescriptor, WorkspaceFolderEntry } from '../workspace/workspace-descriptor';
import type { WorkspaceWatchEvent, WorkspaceWatchEventType } from '../workspace/workspace-watcher';

export type ExplorerNodeKind = 'folder' | 'file';

export interface ExplorerNodeView {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly depth: number;
  readonly kind: ExplorerNodeKind;
  readonly isExpanded: boolean;
  readonly isLeaf: boolean;
  readonly parentId?: string;
  readonly rootIndex: number;
}

export interface ExplorerTreeModelOptions {
  readonly caseSensitive?: boolean;
  readonly sortFoldersFirst?: boolean;
}

export interface ExplorerUpsertInput {
  readonly path: string;
  readonly kind: ExplorerNodeKind;
  readonly name?: string;
  readonly parentPath?: string;
  readonly rootIndex?: number;
  readonly isExpanded?: boolean;
}

interface ExplorerNodeRecord {
  id: string;
  name: string;
  path: string;
  parentId?: string;
  kind: ExplorerNodeKind;
  isExpanded: boolean;
  depth: number;
  rootIndex: number;
  children: string[];
}

export class ExplorerTreeModel {
  private readonly caseSensitive: boolean;
  private readonly sortFoldersFirst: boolean;
  private readonly nodes = new Map<string, ExplorerNodeRecord>();
  private readonly roots: string[] = [];
  private visibleCache?: ExplorerNodeView[];

  constructor(options: ExplorerTreeModelOptions = {}) {
    this.caseSensitive = options.caseSensitive ?? false;
    this.sortFoldersFirst = options.sortFoldersFirst ?? true;
  }

  reset(): void {
    this.nodes.clear();
    this.roots.length = 0;
    this.invalidate();
  }

  loadFromDescriptor(descriptor: WorkspaceDescriptor): void {
    this.reset();
    descriptor.folders.forEach((folder, index) => {
      this.upsertNode({
        path: folder.path,
        kind: 'folder',
        name: folder.name,
        rootIndex: index,
        parentPath: undefined,
        isExpanded: false
      });
    });
    this.invalidate();
  }

  upsertNode(input: ExplorerUpsertInput): ExplorerNodeRecord {
    const id = this.normalizePath(input.path);
    const parentId = input.parentPath ? this.normalizePath(input.parentPath) : undefined;
    const existing = this.nodes.get(id);
    const name = input.name ?? this.displayName(id);
    const rootIndex = input.rootIndex ?? (existing?.rootIndex ?? 0);
    const depth = parentId ? (this.nodes.get(parentId)?.depth ?? this.deriveDepthFromPath(id)) : 0;
    const inheritedChildren = existing ? [...existing.children] : [];
    const record: ExplorerNodeRecord = existing
      ? { ...existing, name, kind: input.kind, parentId, isExpanded: input.isExpanded ?? existing.isExpanded, rootIndex }
      : {
          id,
          name,
          path: id,
          parentId,
          kind: input.kind,
          isExpanded: input.isExpanded ?? (input.kind === 'folder' ? false : true),
          depth,
          rootIndex,
          children: inheritedChildren
        };
    record.depth = parentId ? (this.nodes.get(parentId)?.depth ?? depth) + 1 : 0;
    if (!existing) {
      record.children = [];
    }
    this.nodes.set(id, record);
    if (!parentId) {
      this.addRoot(id, rootIndex);
    } else {
      const parent = this.nodes.get(parentId) ?? this.createMissingParent(parentId);
      if (!parent.children.includes(id)) {
        parent.children.push(id);
        this.sortChildren(parent);
      }
    }
    this.invalidate();
    return record;
  }

  removeNode(path: string): void {
    const id = this.normalizePath(path);
    const target = this.nodes.get(id);
    if (!target) return;
    if (target.parentId) {
      const parent = this.nodes.get(target.parentId);
      if (parent) {
        parent.children = parent.children.filter(childId => childId !== id);
      }
    } else {
      const index = this.roots.indexOf(id);
      if (index >= 0) {
        this.roots.splice(index, 1);
      }
    }
    target.children.forEach(childId => this.removeNode(childId));
    this.nodes.delete(id);
    this.invalidate();
  }

  toggleExpanded(path: string, expanded?: boolean): void {
    const id = this.normalizePath(path);
    const node = this.nodes.get(id);
    if (!node || node.kind !== 'folder') {
      return;
    }
    const nextValue = expanded ?? !node.isExpanded;
    if (node.isExpanded === nextValue) {
      return;
    }
    node.isExpanded = nextValue;
    this.invalidate();
  }

  applyWorkspaceEvent(event: WorkspaceWatchEvent): void {
    const normalizedRoot = this.normalizePath(event.root);
    if (!this.nodes.has(normalizedRoot)) {
      this.upsertNode({ path: normalizedRoot, kind: 'folder', name: this.displayName(normalizedRoot), rootIndex: this.roots.length });
    }
    const id = this.normalizePath(event.absolutePath);
    const parentId = this.getParentPath(id) ?? normalizedRoot;
    const name = this.displayName(id);
    switch (event.type) {
      case 'addDir':
      case 'add': {
        this.upsertNode({
          path: id,
          parentPath: parentId,
          kind: event.type === 'addDir' ? 'folder' : 'file',
          name
        });
        break;
      }
      case 'change': {
        const node = this.nodes.get(id);
        if (node) {
          node.name = name;
          this.invalidate();
        }
        break;
      }
      case 'unlink':
      case 'unlinkDir': {
        this.removeNode(id);
        break;
      }
      default:
        break;
    }
  }

  getVisibleNodes(): ExplorerNodeView[] {
    if (!this.visibleCache) {
      this.visibleCache = this.computeVisibleNodes();
    }
    return [...this.visibleCache];
  }

  private computeVisibleNodes(): ExplorerNodeView[] {
    const views: ExplorerNodeView[] = [];
    const orderedRoots = [...this.roots].sort((a, b) => this.compareNodes(a, b));
    orderedRoots.forEach(rootId => {
      const root = this.nodes.get(rootId);
      if (!root) return;
      this.collectVisible(root, views);
    });
    return views;
  }

  private collectVisible(node: ExplorerNodeRecord, views: ExplorerNodeView[]): void {
    views.push({
      id: node.id,
      name: node.name,
      path: node.path,
      depth: node.depth,
      kind: node.kind,
      isExpanded: node.isExpanded,
      isLeaf: node.kind === 'file' || node.children.length === 0,
      parentId: node.parentId,
      rootIndex: node.rootIndex
    });
    if (node.kind === 'folder' && node.isExpanded) {
      node.children.sort((a, b) => this.compareNodes(a, b));
      node.children.forEach(childId => {
        const child = this.nodes.get(childId);
        if (child) {
          this.collectVisible(child, views);
        }
      });
    }
  }

  private compareNodes(aId: string, bId: string): number {
    const a = this.nodes.get(aId);
    const b = this.nodes.get(bId);
    if (!a || !b) {
      return 0;
    }
    if (this.sortFoldersFirst && a.kind !== b.kind) {
      return a.kind === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: this.caseSensitive ? 'variant' : 'base' });
  }

  private createMissingParent(parentId: string): ExplorerNodeRecord {
    const segments = parentId.split('/');
    const name = segments[segments.length - 1] || parentId;
    const grandParentPath = segments.slice(0, -1).join('/') || undefined;
    const rootIndex = 0;
    const record: ExplorerNodeRecord = {
      id: parentId,
      name,
      path: parentId,
      kind: 'folder',
      parentId: grandParentPath,
      isExpanded: false,
      depth: grandParentPath ? (this.nodes.get(grandParentPath)?.depth ?? 0) + 1 : 0,
      rootIndex,
      children: []
    };
    this.nodes.set(parentId, record);
    if (!grandParentPath) {
      this.addRoot(parentId, rootIndex);
    } else {
      const gp = this.nodes.get(grandParentPath) ?? this.createMissingParent(grandParentPath);
      if (!gp.children.includes(parentId)) {
        gp.children.push(parentId);
        this.sortChildren(gp);
      }
    }
    return record;
  }

  private addRoot(id: string, rootIndex: number): void {
    if (!this.roots.includes(id)) {
      this.roots.push(id);
    }
    const node = this.nodes.get(id);
    if (node) {
      node.rootIndex = rootIndex;
    }
  }

  private sortChildren(node: ExplorerNodeRecord): void {
    node.children.sort((a, b) => this.compareNodes(a, b));
  }

  private displayName(pathValue: string): string {
    const segments = pathValue.split('/');
    const last = segments[segments.length - 1];
    return last || pathValue;
  }

  private normalizePath(pathValue: string): string {
    return normalizeExplorerPath(pathValue, this.caseSensitive);
  }

  private deriveDepthFromPath(pathValue: string): number {
    return pathValue.split('/').length - 1;
  }

  private getParentPath(id: string): string | undefined {
    const idx = id.lastIndexOf('/');
    if (idx <= 0) {
      return undefined;
    }
    return id.slice(0, idx);
  }

  private invalidate(): void {
    this.visibleCache = undefined;
  }
}

export interface VirtualizedSlice<T> {
  readonly items: readonly T[];
  readonly offsetTop: number;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly total: number;
  readonly height: number;
}

export class TreeVirtualizer<T> {
  constructor(private readonly rowHeight: number) {
    if (!Number.isFinite(rowHeight) || rowHeight <= 0) {
      throw new Error('rowHeight must be a positive number');
    }
  }

  compute(items: readonly T[], scrollTop: number, viewportHeight: number): VirtualizedSlice<T> {
    const total = items.length;
    if (total === 0) {
      return { items: [], offsetTop: 0, startIndex: 0, endIndex: 0, total: 0, height: 0 };
    }
    const clampedScroll = Math.max(0, scrollTop);
    const startIndex = Math.min(total - 1, Math.floor(clampedScroll / this.rowHeight));
    const visibleCount = Math.max(1, Math.ceil(viewportHeight / this.rowHeight));
    const endIndex = Math.min(total, startIndex + visibleCount + 1);
    const offsetTop = startIndex * this.rowHeight;
    const slice = items.slice(startIndex, endIndex);
    return {
      items: slice,
      offsetTop,
      startIndex,
      endIndex,
      total,
      height: total * this.rowHeight
    };
  }
}

export function createDescriptorFromFolders(folders: WorkspaceFolderEntry[]): WorkspaceDescriptor {
  const primary = folders[0]?.path ?? '';
  return {
    primary,
    roots: folders.map(folder => folder.path),
    label: folders[0]?.name ?? primary,
    folders
  };
}

export function normalizeExplorerPath(pathValue: string, caseSensitive = false): string {
  if (!pathValue) {
    throw new Error('Path cannot be empty');
  }
  let normalized = pathValue.replace(/\\+/g, '/');
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.replace(/\/+/g, '/').replace(/\/+$/g, '/');
    normalized = normalized.slice(0, -1);
  }
  normalized = normalized.replace(/\/+/g, '/');
  if (!caseSensitive) {
    normalized = normalized.toLowerCase();
  }
  return normalized;
}
