import type { GitHistoryEntry, GitHistoryRequest, GitHistoryResponse } from '@nexus/contracts/ipc';

type HistoryBridge = {
  gitGetHistory(payload: GitHistoryRequest): Promise<GitHistoryResponse>;
};

export type GitHistorySnapshot = {
  repositoryId?: string;
  entries: GitHistoryEntry[];
  limit: number;
  filter?: string;
  loading: boolean;
  error?: string;
};

type SnapshotListener = (snapshot: GitHistorySnapshot) => void;

export class GitHistoryStore {
  private readonly bridge: HistoryBridge;
  private readonly listeners = new Set<SnapshotListener>();
  private snapshot: GitHistorySnapshot = {
    entries: [],
    limit: 50,
    loading: false
  };

  constructor(bridge?: HistoryBridge) {
    const resolved = bridge ?? GitHistoryStore.resolveBridge();
    if (!resolved) {
      throw new Error('Git bridge is unavailable');
    }
    this.bridge = resolved;
  }

  setActiveRepository(repositoryId?: string) {
    this.snapshot = {
      ...this.snapshot,
      repositoryId,
      entries: [],
      loading: Boolean(repositoryId),
      error: undefined
    };
    this.emit();
  }

  setFilter(filter?: string) {
    this.snapshot = { ...this.snapshot, filter };
    this.emit();
  }

  setLimit(limit: number) {
    const normalized = Math.min(Math.max(limit, 1), 200);
    this.snapshot = { ...this.snapshot, limit: normalized };
    this.emit();
  }

  async refresh() {
    const repositoryId = this.snapshot.repositoryId;
    if (!repositoryId) {
      this.snapshot = { ...this.snapshot, entries: [], loading: false };
      this.emit();
      return;
    }
    this.snapshot = { ...this.snapshot, loading: true, error: undefined };
    this.emit();
    try {
      const response = await this.bridge.gitGetHistory({
        repositoryId,
        limit: this.snapshot.limit,
        search: this.snapshot.filter
      });
      this.snapshot = {
        ...this.snapshot,
        entries: response.entries,
        loading: false
      };
      this.emit();
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        loading: false,
        error: this.extractMessage(error)
      };
      this.emit();
      throw error;
    }
  }

  getSnapshot(): GitHistorySnapshot {
    return {
      ...this.snapshot,
      entries: [...this.snapshot.entries]
    };
  }

  onDidChange(listener: SnapshotListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose() {
    this.listeners.clear();
  }

  private emit() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }

  private extractMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private static resolveBridge(): HistoryBridge | undefined {
    if (typeof window !== 'undefined' && window.nexus) {
      return window.nexus;
    }
    return undefined;
  }
}
