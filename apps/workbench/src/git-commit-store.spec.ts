import type { GitCommitResult } from '@nexus/contracts/ipc';
import { GitCommitStore } from './git-commit-store';

describe('GitCommitStore', () => {
  const commitResult: GitCommitResult = {
    repositoryId: 'repo-1',
    commit: {
      sha: 'abc',
      summary: 'feat: test',
      authorName: 'dev',
      authorEmail: 'dev@example.com',
      authorDate: Date.now()
    },
    branch: 'main'
  };

  function createBridge() {
    return {
      gitCommit: jest.fn().mockResolvedValue(commitResult)
    };
  }

  it('tracks repository selection and message state', () => {
    const store = new GitCommitStore(createBridge());
    store.setActiveRepository('repo-1');
    store.setMessage('Initial commit');
    store.toggleSignOff();
    const snapshot = store.getSnapshot();
    expect(snapshot.repositoryId).toBe('repo-1');
    expect(snapshot.message).toBe('Initial commit');
    expect(snapshot.signOff).toBe(true);
  });

  it('executes commits via bridge and resets message', async () => {
    const bridge = createBridge();
    const store = new GitCommitStore(bridge);
    store.setActiveRepository('repo-1');
    store.setMessage('feat: add tests');
    const result = await store.commit();
    expect(result.commit.summary).toContain('feat');
    expect(store.getSnapshot().message).toBe('');
    expect(bridge.gitCommit).toHaveBeenCalledWith(
      expect.objectContaining({ repositoryId: 'repo-1', message: 'feat: add tests' })
    );
  });
});
