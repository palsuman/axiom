import { execFile, type ExecFileException } from 'node:child_process';
import { promisify } from 'node:util';

import type {
  GitDiffRequest,
  GitDiffResponse,
  GitFileStatus,
  GitStagePayload,
  GitStatusEntry,
  GitStatusSummary
} from '@nexus/contracts/ipc';
import type { GitRepository } from './git-types';

const execFileAsync = promisify(execFile);
const MAX_GIT_BUFFER = 10 * 1024 * 1024;

type GitRunnerResult = {
  stdout: string;
};

type GitRunner = (cwd: string, args: string[]) => Promise<GitRunnerResult>;

type GitStatusOptions = {
  gitBinary?: string;
  runner?: GitRunner;
};

export class GitStatusService {
  private readonly gitBinary: string;
  private readonly runner?: GitRunner;

  constructor(options: GitStatusOptions = {}) {
    this.gitBinary = options.gitBinary ?? 'git';
    this.runner = options.runner;
  }

  async getStatus(repository: GitRepository): Promise<GitStatusSummary> {
    const stdout = await this.runGit(repository.worktreePath, ['status', '--porcelain=1', '--branch']);
    const parsed = parsePorcelainStatus(stdout);
    return {
      repositoryId: repository.id,
      worktreePath: repository.worktreePath,
      branch: parsed.branch,
      upstream: parsed.upstream,
      ahead: parsed.ahead,
      behind: parsed.behind,
      detached: parsed.detached,
      timestamp: Date.now(),
      entries: parsed.entries
    };
  }

  async stage(repository: GitRepository, payload: GitStagePayload): Promise<GitStatusSummary> {
    this.ensurePaths(payload.paths);
    await this.runGit(repository.worktreePath, ['add', '--', ...dedupePaths(payload.paths)]);
    return this.getStatus(repository);
  }

  async unstage(repository: GitRepository, payload: GitStagePayload): Promise<GitStatusSummary> {
    this.ensurePaths(payload.paths);
    await this.runGit(repository.worktreePath, ['restore', '--staged', '--', ...dedupePaths(payload.paths)]);
    return this.getStatus(repository);
  }

  async getDiff(repository: GitRepository, payload: GitDiffRequest): Promise<GitDiffResponse> {
    if (!payload?.path) {
      throw new Error('Diff path is required');
    }
    const args = ['diff', '--no-color'];
    if (payload.staged) {
      args.push('--cached');
    }
    args.push('--', payload.path);
    const diff = await this.runGit(repository.worktreePath, args);
    return {
      repositoryId: repository.id,
      path: payload.path,
      staged: Boolean(payload.staged),
      diff,
      summary: summarizeDiff(diff)
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

  private ensurePaths(paths: string[]) {
    if (!Array.isArray(paths) || !paths.length) {
      throw new Error('At least one path is required');
    }
    if (paths.some(path => !path || typeof path !== 'string')) {
      throw new Error('Invalid path provided for git operation');
    }
  }
}

export type ParsedGitStatus = {
  branch?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  detached?: boolean;
  entries: GitStatusEntry[];
};

export function parsePorcelainStatus(output: string): ParsedGitStatus {
  const summary: ParsedGitStatus = {
    entries: []
  };
  if (!output) {
    return summary;
  }
  const lines = output.split('\n');
  for (const rawLine of lines) {
    if (!rawLine) continue;
    if (rawLine.startsWith('##')) {
      parseBranchLine(rawLine, summary);
      continue;
    }
    if (rawLine.startsWith('??')) {
      const path = rawLine.slice(3).trim();
      if (path) {
        summary.entries.push({
          path,
          worktree: 'untracked'
        });
      }
      continue;
    }
    if (rawLine.startsWith('!!')) {
      continue;
    }
    if (rawLine.length < 4) {
      continue;
    }
    const stagedCode = rawLine[0];
    const worktreeCode = rawLine[1];
    const details = rawLine.slice(3);
    const { path, originalPath } = parsePath(details);
    if (!path) continue;
    const entry: GitStatusEntry = {
      path,
      originalPath
    };
    const stagedStatus = mapStatus(stagedCode);
    if (stagedStatus && stagedStatus !== 'untracked') {
      entry.staged = stagedStatus;
    }
    const worktreeStatus = mapStatus(worktreeCode);
    if (worktreeStatus) {
      entry.worktree = worktreeStatus;
    }
    if (stagedCode === 'U' || worktreeCode === 'U') {
      entry.conflicted = true;
    }
    if (!entry.staged && !entry.worktree) {
      continue;
    }
    summary.entries.push(entry);
  }
  return summary;
}

function parseBranchLine(line: string, summary: ParsedGitStatus) {
  const branchLine = line.replace(/^##\s*/, '');
  if (!branchLine) return;
  if (branchLine.includes('no branch')) {
    summary.detached = true;
    const match = branchLine.match(/HEAD\s+\(no branch\)(?:\s+(.+))?/);
    if (match?.[1]) {
      summary.branch = match[1].trim();
    }
    return;
  }
  const [branchPart, remainderRaw] = branchLine.split('...');
  summary.branch = branchPart?.trim();
  if (!remainderRaw) return;
  const bracketIndex = remainderRaw.indexOf('[');
  const upstreamPart = bracketIndex >= 0 ? remainderRaw.slice(0, bracketIndex) : remainderRaw;
  const metadataPart = bracketIndex >= 0 ? remainderRaw.slice(bracketIndex) : '';
  const upstream = upstreamPart.trim();
  if (upstream) {
    summary.upstream = upstream;
  }
  const aheadMatch = metadataPart.match(/ahead\s+(\d+)/);
  if (aheadMatch) {
    summary.ahead = Number(aheadMatch[1]);
  }
  const behindMatch = metadataPart.match(/behind\s+(\d+)/);
  if (behindMatch) {
    summary.behind = Number(behindMatch[1]);
  }
}

function parsePath(details: string) {
  const arrow = details.indexOf(' -> ');
  if (arrow >= 0) {
    return {
      originalPath: details.slice(0, arrow).trim(),
      path: details.slice(arrow + 4).trim()
    };
  }
  return { path: details.trim() };
}

function mapStatus(code: string): GitFileStatus | undefined {
  switch (code) {
    case 'M':
      return 'modified';
    case 'A':
      return 'added';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    case 'C':
      return 'copied';
    case 'T':
      return 'typechange';
    case 'U':
      return 'merged';
    case '?':
      return 'untracked';
    default:
      return undefined;
  }
}

function dedupePaths(paths: string[]) {
  return Array.from(new Set(paths.map(path => path.trim()).filter(Boolean)));
}

function summarizeDiff(diff: string) {
  const summary = { additions: 0, deletions: 0 };
  if (!diff) {
    return summary;
  }
  const lines = diff.split('\n');
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('@@')) {
      continue;
    }
    if (line.startsWith('+')) {
      summary.additions += 1;
    } else if (line.startsWith('-')) {
      summary.deletions += 1;
    }
  }
  return summary;
}
