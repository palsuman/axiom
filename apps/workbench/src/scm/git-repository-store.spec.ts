import type { GitRepositoryInfo } from '@nexus/contracts/ipc';
import { GitRepositoryStore } from './git-repository-store';

describe('GitRepositoryStore', () => {
  it('refreshes repositories via bridge', async () => {
    const repos: GitRepositoryInfo[] = [
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
    const store = new GitRepositoryStore({
      gitListRepositories: jest.fn().mockResolvedValue(repos)
    });
    await store.refresh();
    expect(store.getRepositories()).toEqual(repos);
  });

  it('throws when bridge unavailable', async () => {
    const store = new GitRepositoryStore(undefined);
    await expect(store.refresh()).rejects.toThrow('Git bridge is unavailable');
  });
});
