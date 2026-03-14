import type { GitHistoryEntry } from '@nexus/contracts/ipc';
import { GitHistoryStore } from './git-history-store';

describe('GitHistoryStore', () => {
  const entries: GitHistoryEntry[] = [
    {
      sha: 'abc',
      summary: 'feat: add feature',
      authorName: 'dev',
      authorEmail: 'dev@example.com',
      authorDate: Date.now(),
      committerName: 'dev',
      committerEmail: 'dev@example.com',
      committerDate: Date.now()
    }
  ];

  function createBridge() {
    return {
      gitGetHistory: jest.fn().mockResolvedValue({ repositoryId: 'repo-1', entries })
    };
  }

  it('sets repository and refreshes history', async () => {
    const bridge = createBridge();
    const store = new GitHistoryStore(bridge);
    store.setActiveRepository('repo-1');
    await store.refresh();
    expect(bridge.gitGetHistory).toHaveBeenCalledWith(expect.objectContaining({ repositoryId: 'repo-1' }));
    expect(store.getSnapshot().entries).toHaveLength(1);
  });

  it('applies filters and limits', async () => {
    const bridge = createBridge();
    const store = new GitHistoryStore(bridge);
    store.setActiveRepository('repo-1');
    store.setFilter('feat');
    store.setLimit(10);
    await store.refresh();
    expect(bridge.gitGetHistory).toHaveBeenCalledWith(expect.objectContaining({ search: 'feat', limit: 10 }));
  });
});
