import path from 'node:path';

import type {
  GitCommitPayload,
  GitCommitResult,
  GitDiffRequest,
  GitDiffResponse,
  GitHistoryRequest,
  GitHistoryResponse,
  GitRepositoryInfo,
  GitStagePayload,
  GitStatusSummary
} from '@nexus/contracts/ipc';
import { GitRepositoryManager } from '@nexus/platform/scm/git/git-repository-manager';
import type { GitRepository } from '@nexus/platform/scm/git/git-types';
import { GitCommitService } from '@nexus/platform/scm/git/git-commit-service';
import { GitStatusService } from '@nexus/platform/scm/git/git-status-service';

type ManagerFactory = (roots: string[]) => GitRepositoryManager;

type ManagedSession = {
  manager: GitRepositoryManager;
};

export class GitRepositoryService {
  private readonly sessions = new Map<string, ManagedSession>();

  constructor(
    private readonly factory: ManagerFactory = roots => new GitRepositoryManager(roots),
    private readonly statusService: GitStatusService = new GitStatusService(),
    private readonly commitService: GitCommitService = new GitCommitService()
  ) {}

  async trackSession(sessionId: string, roots: string[]) {
    if (!sessionId || !roots?.length) {
      return;
    }
    const normalized = dedupeRoots(roots);
    const existing = this.sessions.get(sessionId);
    if (existing) {
      await existing.manager.updateRoots(normalized);
      return;
    }
    const manager = this.factory(normalized);
    await manager.start();
    this.sessions.set(sessionId, { manager });
  }

  listRepositories(sessionId: string): GitRepositoryInfo[] {
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      return [];
    }
    return managed.manager.getRepositories();
  }

  detachSession(sessionId: string) {
    const managed = this.sessions.get(sessionId);
    if (!managed) return;
    managed.manager.dispose();
    this.sessions.delete(sessionId);
  }

  dispose() {
    for (const managed of this.sessions.values()) {
      managed.manager.dispose();
    }
    this.sessions.clear();
  }

  async getStatus(sessionId: string, repositoryId: string): Promise<GitStatusSummary> {
    const repo = this.requireRepository(sessionId, repositoryId);
    return this.statusService.getStatus(repo);
  }

  async stage(sessionId: string, payload: GitStagePayload): Promise<GitStatusSummary> {
    const repo = this.requireRepository(sessionId, payload.repositoryId);
    return this.statusService.stage(repo, payload);
  }

  async unstage(sessionId: string, payload: GitStagePayload): Promise<GitStatusSummary> {
    const repo = this.requireRepository(sessionId, payload.repositoryId);
    return this.statusService.unstage(repo, payload);
  }

  async getDiff(sessionId: string, payload: GitDiffRequest): Promise<GitDiffResponse> {
    const repo = this.requireRepository(sessionId, payload.repositoryId);
    return this.statusService.getDiff(repo, payload);
  }

  async commit(sessionId: string, payload: GitCommitPayload): Promise<GitCommitResult> {
    const repo = this.requireRepository(sessionId, payload.repositoryId);
    return this.commitService.commit(repo, payload);
  }

  async getHistory(sessionId: string, payload: GitHistoryRequest): Promise<GitHistoryResponse> {
    const repo = this.requireRepository(sessionId, payload.repositoryId);
    return this.commitService.getHistory(repo, payload);
  }

  private requireRepository(sessionId: string, repositoryId: string): GitRepository {
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      throw new Error('Session is not tracked');
    }
    const repo = managed.manager.getRepositories().find(item => item.id === repositoryId);
    if (!repo) {
      throw new Error(`Repository ${repositoryId} not found for session ${sessionId}`);
    }
    return repo;
  }
}

function dedupeRoots(roots: string[]) {
  return Array.from(new Set(roots.map(root => path.resolve(root))));
}
