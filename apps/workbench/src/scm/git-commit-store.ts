import type { GitCommitPayload, GitCommitResult } from '@nexus/contracts/ipc';

type CommitBridge = {
  gitCommit(payload: GitCommitPayload): Promise<GitCommitResult>;
};

export type GitCommitSnapshot = {
  repositoryId?: string;
  message: string;
  signOff: boolean;
  amend: boolean;
  isCommitting: boolean;
  lastCommit?: GitCommitResult;
  error?: string;
};

type SnapshotListener = (snapshot: GitCommitSnapshot) => void;

export class GitCommitStore {
  private readonly bridge: CommitBridge;
  private readonly listeners = new Set<SnapshotListener>();
  private snapshot: GitCommitSnapshot = {
    message: '',
    signOff: false,
    amend: false,
    isCommitting: false
  };

  constructor(bridge?: CommitBridge) {
    const resolved = bridge ?? GitCommitStore.resolveBridge();
    if (!resolved) {
      throw new Error('Git bridge is unavailable');
    }
    this.bridge = resolved;
  }

  setActiveRepository(repositoryId?: string) {
    this.snapshot = {
      repositoryId,
      message: '',
      signOff: this.snapshot.signOff,
      amend: repositoryId === this.snapshot.repositoryId ? this.snapshot.amend : false,
      isCommitting: false
    };
    this.emit();
  }

  setMessage(message: string) {
    this.snapshot = { ...this.snapshot, message };
    this.emit();
  }

  toggleSignOff() {
    this.snapshot = { ...this.snapshot, signOff: !this.snapshot.signOff };
    this.emit();
  }

  toggleAmend() {
    this.snapshot = { ...this.snapshot, amend: !this.snapshot.amend };
    this.emit();
  }

  async commit(options?: { allowEmpty?: boolean }) {
    const repositoryId = this.snapshot.repositoryId;
    if (!repositoryId) {
      throw new Error('No repository selected');
    }
    this.snapshot = { ...this.snapshot, isCommitting: true, error: undefined };
    this.emit();
    const payload: GitCommitPayload = {
      repositoryId,
      message: this.snapshot.message,
      signOff: this.snapshot.signOff,
      amend: this.snapshot.amend,
      allowEmpty: options?.allowEmpty
    };
    try {
      const result = await this.bridge.gitCommit(payload);
      this.snapshot = {
        ...this.snapshot,
        isCommitting: false,
        message: '',
        lastCommit: result
      };
      this.emit();
      return result;
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        isCommitting: false,
        error: this.extractMessage(error)
      };
      this.emit();
      throw error;
    }
  }

  getSnapshot(): GitCommitSnapshot {
    return { ...this.snapshot, lastCommit: this.snapshot.lastCommit };
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

  private static resolveBridge(): CommitBridge | undefined {
    if (typeof window !== 'undefined' && window.nexus) {
      return window.nexus;
    }
    return undefined;
  }
}
