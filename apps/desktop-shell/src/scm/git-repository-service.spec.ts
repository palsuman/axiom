import type { GitRepositoryInfo } from '@nexus/contracts/ipc';
import type { GitStatusSummary, GitDiffResponse, GitCommitResult, GitHistoryResponse } from '@nexus/contracts/ipc';
import { GitRepositoryService } from './git-repository-service';

class StubManager {
  private readonly repos: GitRepositoryInfo[];
  public updatedRoots: string[][] = [];

  constructor(private readonly initialRoots: string[], repos?: GitRepositoryInfo[]) {
    this.repos = repos ?? [
      {
        id: 'repo-1',
        worktreePath: '/tmp/repo-1',
        gitDir: '/tmp/repo-1/.git',
        isBare: false,
        isSubmodule: false,
        head: { detached: false, ref: 'refs/heads/main', commit: 'abc' },
        lastChangedAt: Date.now()
      }
    ];
  }

  async start() {
    this.updatedRoots.push(this.initialRoots);
  }

  dispose() {
    /* noop */
  }

  async updateRoots(roots: string[]) {
    this.updatedRoots.push(roots);
  }

  getRepositories() {
    return this.repos;
  }
}

class StubStatusService {
  getStatus = jest.fn<Promise<GitStatusSummary>, [GitRepositoryInfo]>();
  stage = jest.fn<Promise<GitStatusSummary>, [GitRepositoryInfo, { repositoryId: string; paths: string[] }]>();
  unstage = jest.fn<Promise<GitStatusSummary>, [GitRepositoryInfo, { repositoryId: string; paths: string[] }]>();
  getDiff = jest.fn<Promise<GitDiffResponse>, [GitRepositoryInfo, { repositoryId: string; path: string; staged?: boolean }]>();
}

class StubCommitService {
  commit = jest.fn<Promise<GitCommitResult>, [GitRepositoryInfo, any]>();
  getHistory = jest.fn<Promise<GitHistoryResponse>, [GitRepositoryInfo, any]>();
}

describe('GitRepositoryService', () => {
  it('tracks sessions and returns repositories', async () => {
    const service = new GitRepositoryService(roots => new StubManager(roots) as unknown as any);
    await service.trackSession('session-a', ['/tmp/a']);
    const repos = service.listRepositories('session-a');
    expect(repos).toHaveLength(1);
    service.detachSession('session-a');
  });

  it('updates roots when session already managed', async () => {
    const manager = new StubManager(['/tmp/a']);
    const service = new GitRepositoryService(() => manager as unknown as any);
    await service.trackSession('session-a', ['/tmp/a']);
    await service.trackSession('session-a', ['/tmp/b']);
    expect(manager.updatedRoots.some(entry => entry.includes('/tmp/b'))).toBe(true);
    service.dispose();
  });

  it('delegates git status operations through status service', async () => {
    const repo: GitRepositoryInfo = {
      id: 'repo-x',
      worktreePath: '/tmp/repo-x',
      gitDir: '/tmp/repo-x/.git',
      isBare: false,
      isSubmodule: false,
      head: { detached: false, ref: 'refs/heads/main', commit: 'abc' },
      lastChangedAt: Date.now()
    };
    const manager = new StubManager(['/tmp/repo-x'], [repo]);
    const statusService = new StubStatusService();
    const commitService = new StubCommitService();
    statusService.getStatus.mockResolvedValue({
      repositoryId: repo.id,
      worktreePath: repo.worktreePath,
      entries: [],
      timestamp: Date.now()
    });
    commitService.commit.mockResolvedValue({
      repositoryId: repo.id,
      commit: {
        sha: 'abc',
        summary: 'test',
        authorName: 'dev',
        authorEmail: 'dev@example.com',
        authorDate: Date.now()
      }
    });
    commitService.getHistory.mockResolvedValue({ repositoryId: repo.id, entries: [] });
    const service = new GitRepositoryService(() => manager as unknown as any, statusService as unknown as any, commitService as unknown as any);
    await service.trackSession('session-a', ['/tmp/repo-x']);
    await service.getStatus('session-a', repo.id);
    expect(statusService.getStatus).toHaveBeenCalled();
    statusService.stage.mockResolvedValue({
      repositoryId: repo.id,
      worktreePath: repo.worktreePath,
      entries: [],
      timestamp: Date.now()
    });
    await service.stage('session-a', { repositoryId: repo.id, paths: ['src/app.ts'] });
    expect(statusService.stage).toHaveBeenCalledWith(expect.objectContaining({ id: repo.id }), {
      repositoryId: repo.id,
      paths: ['src/app.ts']
    });
    statusService.getDiff.mockResolvedValue({
      repositoryId: repo.id,
      path: 'src/app.ts',
      staged: false,
      diff: '',
      summary: { additions: 0, deletions: 0 }
    });
    await service.getDiff('session-a', { repositoryId: repo.id, path: 'src/app.ts' });
    expect(statusService.getDiff).toHaveBeenCalled();
    await service.commit('session-a', { repositoryId: repo.id, message: 'test' });
    expect(commitService.commit).toHaveBeenCalled();
    await service.getHistory('session-a', { repositoryId: repo.id });
    expect(commitService.getHistory).toHaveBeenCalled();
  });
});
