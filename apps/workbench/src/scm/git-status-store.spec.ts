import type { GitDiffResponse, GitStatusSummary } from '@nexus/contracts/ipc';
import { GitStatusStore } from './git-status-store';

describe('GitStatusStore', () => {
  type BridgeMocks = {
    gitGetStatus: jest.Mock<Promise<GitStatusSummary>, [unknown]>;
    gitStage: jest.Mock<Promise<GitStatusSummary>, [unknown]>;
    gitUnstage: jest.Mock<Promise<GitStatusSummary>, [unknown]>;
    gitGetDiff: jest.Mock<Promise<GitDiffResponse>, [unknown]>;
  };

  const baseSummary: GitStatusSummary = {
    repositoryId: 'repo-1',
    worktreePath: '/tmp/repo-1',
    branch: 'main',
    upstream: 'origin/main',
    ahead: 1,
    behind: 0,
    detached: false,
    entries: [
      { path: 'src/app.ts', worktree: 'modified' },
      { path: 'README.md', staged: 'modified' }
    ],
    timestamp: Date.now()
  };

  const baseDiff: GitDiffResponse = {
    repositoryId: 'repo-1',
    path: 'src/app.ts',
    staged: false,
    diff: 'diff --git a/src/app.ts b/src/app.ts',
    summary: { additions: 0, deletions: 0 }
  };

  function createBridge(overrides?: Partial<BridgeMocks>): BridgeMocks {
    return {
      gitGetStatus: jest.fn().mockResolvedValue(baseSummary),
      gitStage: jest.fn().mockResolvedValue(baseSummary),
      gitUnstage: jest.fn().mockResolvedValue(baseSummary),
      gitGetDiff: jest.fn().mockResolvedValue(baseDiff),
      ...overrides
    };
  }

  it('refreshes status when repository is set', async () => {
    const bridge = createBridge();
    const store = new GitStatusStore(bridge);
    await store.setActiveRepository('repo-1');
    expect(bridge.gitGetStatus).toHaveBeenCalledWith({ repositoryId: 'repo-1' });
    const snapshot = store.getSnapshot();
    expect(snapshot.branch).toBe('main');
    expect(snapshot.workingTree).toHaveLength(1);
    expect(snapshot.staged).toHaveLength(1);
  });

  it('stages changes via bridge and updates snapshot', async () => {
    const stagedSummary: GitStatusSummary = {
      ...baseSummary,
      entries: [{ path: 'src/app.ts', staged: 'modified' }],
      timestamp: Date.now()
    };
    const bridge = createBridge({
      gitStage: jest.fn().mockResolvedValue(stagedSummary),
      gitGetStatus: jest.fn().mockResolvedValue(stagedSummary)
    });
    const store = new GitStatusStore(bridge);
    await store.setActiveRepository('repo-1');
    await store.stage(['src/app.ts']);
    expect(bridge.gitStage).toHaveBeenCalledWith({ repositoryId: 'repo-1', paths: ['src/app.ts'] });
    expect(store.getSnapshot().staged).toHaveLength(1);
  });

  it('retrieves diff for selected entry', async () => {
    const bridge = createBridge();
    const store = new GitStatusStore(bridge);
    await store.setActiveRepository('repo-1');
    const result = await store.selectEntry('src/app.ts', 'working');
    expect(result).toBe(true);
    expect(bridge.gitGetDiff).toHaveBeenCalledWith({ repositoryId: 'repo-1', path: 'src/app.ts', staged: false });
    expect(store.getSnapshot().diff?.path).toBe('src/app.ts');
  });
});
