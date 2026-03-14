import fs from 'node:fs';
import path from 'node:path';

export type WindowBounds = {
  width: number;
  height: number;
  x?: number;
  y?: number;
};

export type StoredWindowState = {
  id: string;
  bounds: WindowBounds;
  workspace?: string;
  workspaceDescriptor?: string;
  workspaceLabel?: string;
  workspaceRoots?: string[];
  workspacePrimary?: string;
  lastOpenedAt?: number;
  lastFocusedAt?: number;
};

export class WindowStateStore {
  private cache: StoredWindowState[] | null = null;
  private filePath: string;

  constructor(private baseDir: string) {
    this.filePath = path.join(baseDir, 'window-state.json');
  }

  private ensureDir() {
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  private loadFromDisk(): StoredWindowState[] {
    if (!fs.existsSync(this.filePath)) return [];
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(state => this.normalizeState(state))
        .filter((state): state is StoredWindowState => Boolean(state));
    } catch {
      return [];
    }
  }

  private normalizeState(state: unknown): StoredWindowState | null {
    if (!state || typeof state !== 'object') return null;
    const { id, bounds, workspace, lastOpenedAt, lastFocusedAt } = state as Partial<StoredWindowState>;
    if (!id || typeof id !== 'string') return null;
    if (!bounds || typeof bounds.width !== 'number' || typeof bounds.height !== 'number') {
      return null;
    }
    const normalizedBounds: WindowBounds = {
      width: bounds.width,
      height: bounds.height,
      x: typeof bounds.x === 'number' ? bounds.x : undefined,
      y: typeof bounds.y === 'number' ? bounds.y : undefined
    };
    const normalized: StoredWindowState = { id, bounds: normalizedBounds };
    if (typeof workspace === 'string' && workspace.trim()) {
      normalized.workspace = workspace;
    }
    if (typeof (state as { workspaceDescriptor?: unknown }).workspaceDescriptor === 'string') {
      normalized.workspaceDescriptor = (state as { workspaceDescriptor: string }).workspaceDescriptor;
    }
    if (typeof (state as { workspaceLabel?: unknown }).workspaceLabel === 'string') {
      normalized.workspaceLabel = (state as { workspaceLabel: string }).workspaceLabel;
    }
    if (typeof (state as { workspacePrimary?: unknown }).workspacePrimary === 'string') {
      normalized.workspacePrimary = (state as { workspacePrimary: string }).workspacePrimary;
    }
    if (Array.isArray((state as { workspaceRoots?: unknown }).workspaceRoots)) {
      normalized.workspaceRoots = ((state as { workspaceRoots: unknown }).workspaceRoots as unknown[])
        .filter(root => typeof root === 'string')
        .map(root => root as string);
    }
    if (typeof lastOpenedAt === 'number' && Number.isFinite(lastOpenedAt)) {
      normalized.lastOpenedAt = lastOpenedAt;
    }
    if (typeof lastFocusedAt === 'number' && Number.isFinite(lastFocusedAt)) {
      normalized.lastFocusedAt = lastFocusedAt;
    }
    return normalized;
  }

  private saveToDisk(states: StoredWindowState[]) {
    this.ensureDir();
    fs.writeFileSync(this.filePath, JSON.stringify(states, null, 2), 'utf8');
  }

  getAll(): StoredWindowState[] {
    if (this.cache === null) {
      this.cache = this.loadFromDisk();
    }
    return this.cache;
  }

  nextId(): string {
    const states = this.getAll();
    const ids = states.map(state => parseInt(state.id.replace(/[^0-9]/g, ''), 10)).filter(n => !isNaN(n));
    const next = ids.length ? Math.max(...ids) + 1 : 1;
    return `window-${next}`;
  }

  save(state: StoredWindowState) {
    const states = this.getAll();
    const existingIndex = states.findIndex(s => s.id === state.id);
    if (existingIndex >= 0) {
      states[existingIndex] = state;
    } else {
      states.push(state);
    }
    this.cache = states;
    this.saveToDisk(states);
  }

  remove(id: string) {
    const states = this.getAll();
    const filtered = states.filter(state => state.id !== id);
    this.cache = filtered;
    this.saveToDisk(filtered);
  }

  replaceAll(states: StoredWindowState[]) {
    const sanitized = states
      .map(state => this.normalizeState(state))
      .filter((state): state is StoredWindowState => Boolean(state));
    this.cache = sanitized;
    this.saveToDisk(sanitized);
  }
}
