import { execFile, type ExecFileException } from 'node:child_process';
import { promisify } from 'node:util';

import type { GitCommitPayload, GitCommitResult, GitHistoryEntry, GitHistoryRequest, GitHistoryResponse } from '@nexus/contracts/ipc';
import type { GitRepository } from './git-types';

const execFileAsync = promisify(execFile);
const MAX_GIT_BUFFER = 10 * 1024 * 1024;
const RECORD_SEPARATOR = '\x1e';
const FIELD_SEPARATOR = '\x1f';

type GitRunnerResult = { stdout: string };
type GitRunner = (cwd: string, args: string[]) => Promise<GitRunnerResult>;

export type GitCommitServiceOptions = {
  gitBinary?: string;
  runner?: GitRunner;
};

export class GitCommitService {
  private readonly gitBinary: string;
  private readonly runner?: GitRunner;

  constructor(options: GitCommitServiceOptions = {}) {
    this.gitBinary = options.gitBinary ?? 'git';
    this.runner = options.runner;
  }

  async commit(repository: GitRepository, payload: GitCommitPayload): Promise<GitCommitResult> {
    if (!payload?.message || !payload.message.trim()) {
      throw new Error('Commit message is required');
    }
    const args = ['commit', '--message', payload.message];
    if (payload.signOff) {
      args.push('--signoff');
    }
    if (payload.amend) {
      args.push('--amend');
    }
    if (payload.allowEmpty) {
      args.push('--allow-empty');
    }
    await this.runGit(repository.worktreePath, args);
    return this.describeHead(repository);
  }

  async getHistory(repository: GitRepository, request: GitHistoryRequest): Promise<GitHistoryResponse> {
    const limit = request.limit && request.limit > 0 ? Math.min(request.limit, 200) : 100;
    const format =
      ['%H', '%s', '%b', '%an', '%ae', '%ad', '%cn', '%ce', '%cd', '%D'].join(FIELD_SEPARATOR) + RECORD_SEPARATOR;
    const args = ['log', `--pretty=format:${format}`, `--max-count=${limit}`, '--date=iso-strict'];
    if (request.search) {
      args.push(`--grep=${request.search}`);
    }
    const stdout = await this.runGit(repository.worktreePath, args);
    const entries = parseHistory(stdout);
    return {
      repositoryId: repository.id,
      entries
    };
  }

  private async describeHead(repository: GitRepository): Promise<GitCommitResult> {
    const format = ['%H', '%s', '%b', '%an', '%ae', '%ad', '%D'].join(FIELD_SEPARATOR);
    const stdout = await this.runGit(repository.worktreePath, ['log', '-1', `--pretty=format:${format}`, '--date=iso-strict']);
    const [sha, summary, body, authorName, authorEmail, authorDate, refsRaw] = stdout.split(FIELD_SEPARATOR);
    return {
      repositoryId: repository.id,
      commit: {
        sha: sha ?? '',
        summary: summary ?? '',
        body: body?.trim() ? body : undefined,
        authorName: authorName ?? '',
        authorEmail: authorEmail ?? '',
        authorDate: authorDate ? Date.parse(authorDate) : Date.now()
      },
      branch: refsRaw?.split(',').map(ref => ref.trim()).find(ref => ref.startsWith('HEAD -> '))?.replace('HEAD -> ', '')
    };
  }

  private async runGit(cwd: string, args: string[]) {
    if (this.runner) {
      const result = await this.runner(cwd, args);
      return result.stdout;
    }
    try {
      const { stdout } = await execFileAsync(this.gitBinary, args, { cwd, maxBuffer: MAX_GIT_BUFFER });
      return stdout.toString();
    } catch (error) {
      const execError = error as ExecFileException & { stderr?: string };
      const detail = execError.stderr?.toString().trim() || execError.message;
      throw new Error(`git ${args[0]} failed in ${cwd}: ${detail}`);
    }
  }
}

function parseHistory(output: string): GitHistoryEntry[] {
  if (!output) {
    return [];
  }
  return output
    .split(RECORD_SEPARATOR)
    .map(record => record.trim())
    .filter(Boolean)
    .map(record => {
      const [sha, summary, body, authorName, authorEmail, authorDate, committerName, committerEmail, committerDate, refsRaw] =
        record.split(FIELD_SEPARATOR);
      return {
        sha: sha ?? '',
        summary: summary ?? '',
        body: body?.trim() ? body : undefined,
        authorName: authorName ?? '',
        authorEmail: authorEmail ?? '',
        authorDate: authorDate ? Date.parse(authorDate) : Date.now(),
        committerName: committerName ?? '',
        committerEmail: committerEmail ?? '',
        committerDate: committerDate ? Date.parse(committerDate) : Date.now(),
        refs: refsRaw ? refsRaw.split(',').map(ref => ref.trim()).filter(Boolean) : undefined
      };
    });
}
