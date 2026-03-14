import fs from 'node:fs';
import path from 'node:path';
import { readEnv } from './env';

export type WorkspaceHistoryEntry = {
  path: string;
  label: string;
  lastOpenedAt: number;
  descriptorPath?: string;
  primary?: string;
  roots?: string[];
};

export type WorkspaceHistoryRecord = {
  path: string;
  label?: string;
  descriptorPath?: string;
  roots?: string[];
  primary?: string;
};

export type WorkspaceHistoryOptions = {
  historyDir?: string;
  limit?: number;
};

const DEFAULT_LIMIT = 20;
const HISTORY_FILENAME = 'recent-workspaces.json';

export class WorkspaceHistoryStore {
  private readonly historyDir: string;
  private readonly limit: number;
  private readonly historyFile: string;
  private entries: WorkspaceHistoryEntry[] = [];

  constructor(options: WorkspaceHistoryOptions = {}) {
    this.limit = options.limit ?? DEFAULT_LIMIT;
    this.historyDir = options.historyDir ?? WorkspaceHistoryStore.resolveHistoryDir();
    this.historyFile = path.join(this.historyDir, HISTORY_FILENAME);
    this.load();
  }

  static resolveHistoryDir() {
    try {
      const env = readEnv();
      return env.workspaceDataDir;
    } catch {
      return path.join(process.cwd(), '.nexus', 'workspaces');
    }
  }

  list() {
    return [...this.entries];
  }

  record(record: WorkspaceHistoryRecord) {
    if (!record?.path) {
      throw new Error('Workspace path is required');
    }
    const normalizedPrimary = path.resolve(record.primary ?? record.path);
    const descriptorPath = record.descriptorPath ? path.resolve(record.descriptorPath) : undefined;
    const storedPath = descriptorPath ?? path.resolve(record.path);
    const inferredLabel = record.label ?? this.inferLabel(descriptorPath ?? normalizedPrimary);
    const roots =
      record.roots?.length && record.roots.every(root => typeof root === 'string')
        ? record.roots.map(root => path.resolve(root as string))
        : [normalizedPrimary];
    const entry: WorkspaceHistoryEntry = {
      path: storedPath,
      label: inferredLabel,
      descriptorPath,
      primary: normalizedPrimary,
      roots,
      lastOpenedAt: Date.now()
    };
    this.entries = [entry, ...this.entries.filter(item => item.path !== storedPath)].slice(0, this.limit);
    this.save();
    return entry;
  }

  private ensureDir() {
    fs.mkdirSync(this.historyDir, { recursive: true });
  }

  private load() {
    try {
      const raw = fs.readFileSync(this.historyFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.entries = parsed
          .filter(
            (item): item is WorkspaceHistoryEntry =>
              Boolean(item && typeof item.path === 'string' && typeof item.label === 'string' && typeof item.lastOpenedAt === 'number')
          )
          .slice(0, this.limit);
      }
    } catch {
      this.entries = [];
    }
  }

  private save() {
    this.ensureDir();
    fs.writeFileSync(this.historyFile, JSON.stringify(this.entries, null, 2), 'utf8');
  }

  private inferLabel(workspacePath: string) {
    const base = path.basename(workspacePath);
    return base || workspacePath;
  }
}
