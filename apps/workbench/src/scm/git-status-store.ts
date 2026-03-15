import type {
  GitDiffRequest,
  GitDiffResponse,
  GitStagePayload,
  GitStatusEntry,
  GitStatusRequest,
  GitStatusSummary
} from '@nexus/contracts/ipc';
import { resolveNexusBridge } from '../boot/nexus-bridge-resolver';

type GitBridge = {
  gitGetStatus(payload: GitStatusRequest): Promise<GitStatusSummary>;
  gitStage(payload: GitStagePayload): Promise<GitStatusSummary>;
  gitUnstage(payload: GitStagePayload): Promise<GitStatusSummary>;
  gitGetDiff(payload: GitDiffRequest): Promise<GitDiffResponse>;
};

export type GitStatusListItem = GitStatusEntry & { location: 'staged' | 'working' };

export type GitStatusSnapshot = {
  repositoryId?: string;
  branch?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  detached?: boolean;
  staged: GitStatusListItem[];
  workingTree: GitStatusListItem[];
  loading: boolean;
  error?: string;
  lastUpdated?: number;
  selection?: {
    path: string;
    location: 'staged' | 'working';
  };
  diff?: GitDiffResponse;
};

type SnapshotListener = (snapshot: GitStatusSnapshot) => void;

export class GitStatusStore {
  private readonly listeners = new Set<SnapshotListener>();
  private readonly bridge: GitBridge;
  private snapshot: GitStatusSnapshot = {
    staged: [],
    workingTree: [],
    loading: false
  };
  private activeRepositoryId?: string;

  constructor(bridge?: GitBridge) {
    const resolved = bridge ?? GitStatusStore.resolveBridge();
    if (!resolved) {
      throw new Error('Git bridge is unavailable');
    }
    this.bridge = resolved;
  }

  async setActiveRepository(repositoryId?: string) {
    this.activeRepositoryId = repositoryId;
    if (!repositoryId) {
      this.snapshot = { staged: [], workingTree: [], loading: false };
      this.emitChange();
      return;
    }
    await this.refresh();
  }

  async refresh() {
    if (!this.activeRepositoryId) {
      this.snapshot = { staged: [], workingTree: [], loading: false };
      this.emitChange();
      return;
    }
    this.snapshot = { ...this.snapshot, loading: true, error: undefined };
    this.emitChange();
    try {
      const summary = await this.bridge.gitGetStatus({ repositoryId: this.activeRepositoryId });
      this.applySummary(summary);
    } catch (error) {
      this.snapshot = { ...this.snapshot, loading: false, error: this.extractMessage(error) };
      this.emitChange();
      throw error;
    }
  }

  async stage(paths: string[]) {
    await this.handleMutation(paths, payload => this.bridge.gitStage(payload));
  }

  async unstage(paths: string[]) {
    await this.handleMutation(paths, payload => this.bridge.gitUnstage(payload));
  }

  async selectEntry(path: string, location: 'staged' | 'working') {
    if (!this.activeRepositoryId || !path) {
      this.snapshot = { ...this.snapshot, selection: undefined, diff: undefined };
      this.emitChange();
      return false;
    }
    this.snapshot = { ...this.snapshot, selection: { path, location }, diff: undefined, error: undefined };
    this.emitChange();
    try {
      const diff = await this.bridge.gitGetDiff({
        repositoryId: this.activeRepositoryId,
        path,
        staged: location === 'staged'
      });
      this.snapshot = { ...this.snapshot, diff };
      this.emitChange();
      return true;
    } catch (error) {
      this.snapshot = { ...this.snapshot, error: this.extractMessage(error) };
      this.emitChange();
      throw error;
    }
  }

  getSnapshot(): GitStatusSnapshot {
    return {
      ...this.snapshot,
      staged: [...this.snapshot.staged],
      workingTree: [...this.snapshot.workingTree],
      selection: this.snapshot.selection ? { ...this.snapshot.selection } : undefined,
      diff: this.snapshot.diff ? { ...this.snapshot.diff } : undefined
    };
  }

  onDidChange(listener: SnapshotListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose() {
    this.listeners.clear();
  }

  private async handleMutation(
    paths: string[],
    mutate: (payload: GitStagePayload) => Promise<GitStatusSummary>
  ) {
    if (!this.activeRepositoryId) {
      throw new Error('No active repository');
    }
    if (!Array.isArray(paths) || !paths.length) {
      return;
    }
    const payload: GitStagePayload = {
      repositoryId: this.activeRepositoryId,
      paths
    };
    this.snapshot = { ...this.snapshot, loading: true, error: undefined };
    this.emitChange();
    try {
      const summary = await mutate(payload);
      this.applySummary(summary);
    } catch (error) {
      this.snapshot = { ...this.snapshot, loading: false, error: this.extractMessage(error) };
      this.emitChange();
      throw error;
    }
  }

  private applySummary(summary: GitStatusSummary) {
    const staged = buildList(summary.entries, 'staged');
    const workingTree = buildList(summary.entries, 'working');
    const selection = this.snapshot.selection;
    const hasSelection =
      selection &&
      (selection.location === 'staged'
        ? staged.some(item => item.path === selection.path)
        : workingTree.some(item => item.path === selection.path));
    this.snapshot = {
      repositoryId: summary.repositoryId,
      branch: summary.branch,
      upstream: summary.upstream,
      ahead: summary.ahead,
      behind: summary.behind,
      detached: summary.detached,
      staged,
      workingTree,
      loading: false,
      error: undefined,
      lastUpdated: summary.timestamp,
      selection: hasSelection ? selection : undefined,
      diff: hasSelection ? this.snapshot.diff : undefined
    };
    this.emitChange();
  }

  private emitChange() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }

  private extractMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private static resolveBridge(): GitBridge | undefined {
    return resolveNexusBridge<GitBridge>();
  }
}

function buildList(entries: GitStatusEntry[], location: 'staged' | 'working'): GitStatusListItem[] {
  return entries
    .filter(entry => (location === 'staged' ? Boolean(entry.staged) : Boolean(entry.worktree)))
    .map(entry => ({
      ...entry,
      location
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}
