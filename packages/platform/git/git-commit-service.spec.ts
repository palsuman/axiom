import type { GitRepository } from './git-types';
import { GitCommitService } from './git-commit-service';

describe('GitCommitService', () => {
  const repository: GitRepository = {
    id: 'repo-1',
    worktreePath: '/tmp/repo-1',
    gitDir: '/tmp/repo-1/.git',
    isBare: false,
    isSubmodule: false,
    head: { detached: false, ref: 'refs/heads/main', commit: 'abc' },
    lastChangedAt: Date.now()
  };

  it('commits with message and returns head description', async () => {
    const calls: Array<{ cwd: string; args: string[] }> = [];
    const service = new GitCommitService({
      runner: async (cwd, args) => {
        calls.push({ cwd, args });
        if (args[0] === 'log') {
          return {
            stdout: ['123', 'summary', 'body', 'Alice', 'alice@example.com', '2024-01-01T00:00:00Z', 'HEAD -> main'].join('\x1f')
          };
        }
        return { stdout: '' };
      }
    });
    const result = await service.commit(repository, { repositoryId: repository.id, message: 'Initial commit', signOff: true });
    expect(calls[0]?.args).toContain('commit');
    expect(result.commit.summary).toBe('summary');
    expect(result.branch).toBe('main');
  });

  it('fetches history with filters', async () => {
    const service = new GitCommitService({
      runner: async (_cwd, args) => {
        if (args[0] === 'log') {
          return {
            stdout:
              ['123', 'feat: add file', '', 'Alice', 'alice@example.com', '2024-01-01T00:00:00Z', 'Alice', 'alice@example.com', '2024-01-01T00:00:00Z', 'HEAD -> main'].join(
                '\x1f'
              ) +
              '\x1e'
          };
        }
        return { stdout: '' };
      }
    });
    const response = await service.getHistory(repository, { repositoryId: repository.id, limit: 5, search: 'feat' });
    expect(response.entries).toHaveLength(1);
    expect(response.entries[0]?.summary).toContain('feat');
  });
});
