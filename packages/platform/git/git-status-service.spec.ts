import type { GitRepository } from './git-types';
import { GitStatusService, parsePorcelainStatus } from './git-status-service';

describe('parsePorcelainStatus', () => {
  it('parses branch metadata and entries', () => {
    const output = `## main...origin/main [ahead 1, behind 2]
 M src/app.ts
AM package.json
?? new-file.ts
`;
    const parsed = parsePorcelainStatus(output);
    expect(parsed.branch).toBe('main');
    expect(parsed.upstream).toBe('origin/main');
    expect(parsed.ahead).toBe(1);
    expect(parsed.behind).toBe(2);
    expect(parsed.entries).toHaveLength(3);
    expect(parsed.entries.find(entry => entry.path === 'src/app.ts')?.worktree).toBe('modified');
    const stagedEntry = parsed.entries.find(entry => entry.path === 'package.json');
    expect(stagedEntry?.staged).toBe('added');
    expect(parsed.entries.find(entry => entry.path === 'new-file.ts')?.worktree).toBe('untracked');
  });
});

describe('GitStatusService', () => {
  const repository: GitRepository = {
    id: 'repo-1',
    worktreePath: '/tmp/repo-1',
    gitDir: '/tmp/repo-1/.git',
    isBare: false,
    isSubmodule: false,
    head: { detached: false, ref: 'refs/heads/main', commit: 'abc' },
    lastChangedAt: Date.now()
  };

  it('runs status command through runner', async () => {
    const runner = jest.fn().mockResolvedValue({
      stdout: `## main
 M src/app.ts
`
    });
    const service = new GitStatusService({ runner });
    const summary = await service.getStatus(repository);
    expect(runner).toHaveBeenCalledWith(repository.worktreePath, ['status', '--porcelain=1', '--branch']);
    expect(summary.branch).toBe('main');
    expect(summary.entries[0]?.path).toBe('src/app.ts');
  });

  it('stages and unstages paths then refreshes status', async () => {
    const calls: Array<{ cwd: string; args: string[] }> = [];
    const service = new GitStatusService({
      runner: async (cwd, args) => {
        calls.push({ cwd, args });
        if (args[0] === 'status') {
          return { stdout: '## main\n M src/app.ts\n' };
        }
        return { stdout: '' };
      }
    });
    await service.stage(repository, { repositoryId: repository.id, paths: ['src/app.ts'] });
    await service.unstage(repository, { repositoryId: repository.id, paths: ['src/app.ts'] });
    const stagedCall = calls.find(call => call.args[0] === 'add');
    expect(stagedCall?.args).toEqual(['add', '--', 'src/app.ts']);
    const unstageCall = calls.find(call => call.args[0] === 'restore');
    expect(unstageCall?.args).toEqual(['restore', '--staged', '--', 'src/app.ts']);
  });

  it('retrieves diffs with summary counts', async () => {
    const runner = jest.fn().mockImplementation((_cwd: string, args: string[]) => {
      if (args[0] === 'diff') {
        return {
          stdout: `diff --git a/src/app.ts b/src/app.ts
@@
-const foo = 1;
+const foo = 2;
`
        };
      }
      return { stdout: '## main\n' };
    });
    const service = new GitStatusService({ runner });
    const diff = await service.getDiff(repository, { repositoryId: repository.id, path: 'src/app.ts', staged: true });
    expect(diff.staged).toBe(true);
    expect(diff.summary.additions).toBe(1);
    expect(diff.summary.deletions).toBe(1);
    expect(runner).toHaveBeenCalledWith(repository.worktreePath, ['diff', '--no-color', '--cached', '--', 'src/app.ts']);
  });
});
