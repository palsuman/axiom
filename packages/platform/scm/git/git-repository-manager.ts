import EventEmitter from 'node:events';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';

import chokidar, { type FSWatcher } from 'chokidar';

import type { GitHeadInfo } from '@nexus/contracts/ipc';
import type { GitRepository } from './git-types';
import { createRepositoryId, readHeadInfo, resolveGitDirectory } from './git-utils';

export type GitRepositoryManagerOptions = {
  maxDepth?: number;
  rescanIntervalMs?: number;
  watchHead?: boolean;
};

type RepositoryRecord = {
  repo: GitRepository;
  watcher?: FSWatcher;
};

type RepositoryEvent = 'repo:add' | 'repo:remove' | 'repo:change';

const DEFAULT_IGNORES = new Set(['.git', '.nexus', 'node_modules', '.idea', '.vscode', 'dist', 'build']);

export class GitRepositoryManager extends EventEmitter {
  private roots: string[];
  private readonly options: Required<GitRepositoryManagerOptions>;
  private readonly repositories = new Map<string, RepositoryRecord>();
  private rescanTimer?: NodeJS.Timeout;
  private disposed = false;

  constructor(roots: string[], options: GitRepositoryManagerOptions = {}) {
    super();
    this.roots = dedupeRoots(roots);
    this.options = {
      maxDepth: options.maxDepth ?? 3,
      rescanIntervalMs: options.rescanIntervalMs ?? 5000,
      watchHead: options.watchHead ?? true
    };
  }

  async start() {
    await this.scan();
    if (this.options.rescanIntervalMs > 0) {
      this.rescanTimer = setInterval(() => {
        this.scan().catch(() => undefined);
      }, this.options.rescanIntervalMs);
    }
  }

  async refreshNow() {
    await this.scan();
  }

  async updateRoots(roots: string[]) {
    this.roots = dedupeRoots(roots);
    await this.scan();
  }

  getRepositories(): GitRepository[] {
    return Array.from(this.repositories.values()).map(record => ({ ...record.repo }));
  }

  onDidAddRepository(listener: (repo: GitRepository) => void) {
    this.on('repo:add', listener);
    return () => this.off('repo:add', listener);
  }

  onDidRemoveRepository(listener: (repo: GitRepository) => void) {
    this.on('repo:remove', listener);
    return () => this.off('repo:remove', listener);
  }

  onDidChangeRepository(listener: (repo: GitRepository) => void) {
    this.on('repo:change', listener);
    return () => this.off('repo:change', listener);
  }

  dispose() {
    if (this.rescanTimer) {
      clearInterval(this.rescanTimer);
      this.rescanTimer = undefined;
    }
    Array.from(this.repositories.values()).forEach(record => record.watcher?.close().catch(() => undefined));
    this.repositories.clear();
    this.disposed = true;
  }

  private async scan() {
    if (this.disposed) return;
    const discovered = await discoverRepositories(this.roots, this.options.maxDepth);
    const discoveredMap = new Map<string, DiscoveredRepository>();
    discovered.forEach(repo => {
      discoveredMap.set(repo.worktreePath, repo);
    });

    for (const worktreePath of this.repositories.keys()) {
      if (!discoveredMap.has(worktreePath)) {
        this.removeRepository(worktreePath);
      }
    }

    for (const repoInfo of discoveredMap.values()) {
      const existing = this.repositories.get(repoInfo.worktreePath);
      if (existing) {
        await this.updateHead(existing.repo);
      } else {
        await this.addRepository(repoInfo);
      }
    }
  }

  private async addRepository(info: DiscoveredRepository) {
    try {
      const head = await readHeadInfo(info.gitDir);
      const repo: GitRepository = {
        id: createRepositoryId(info.worktreePath),
        worktreePath: info.worktreePath,
        gitDir: info.gitDir,
        isBare: info.isBare,
        isSubmodule: info.isSubmodule,
        head,
        lastChangedAt: Date.now()
      };
      const record: RepositoryRecord = { repo };
      if (this.options.watchHead) {
        record.watcher = chokidar
          .watch([path.join(info.gitDir, 'HEAD'), path.join(info.gitDir, 'refs/heads')], {
            ignoreInitial: true,
            depth: 2
          })
          .on('add', () => this.updateHead(repo))
          .on('change', () => this.updateHead(repo))
          .on('unlink', () => this.updateHead(repo));
      }
      this.repositories.set(info.worktreePath, record);
      this.emit('repo:add', { ...repo });
    } catch {
      // ignore invalid repos
    }
  }

  private removeRepository(worktreePath: string) {
    const record = this.repositories.get(worktreePath);
    if (!record) return;
    record.watcher?.close().catch(() => undefined);
    this.repositories.delete(worktreePath);
    this.emit('repo:remove', { ...record.repo });
  }

  private async updateHead(repo: GitRepository) {
    try {
      const head = await readHeadInfo(repo.gitDir);
      repo.head = head;
      repo.lastChangedAt = Date.now();
      this.emit('repo:change', { ...repo });
    } catch {
      // ignore transient errors
    }
  }
}

type DiscoveredRepository = {
  worktreePath: string;
  gitDir: string;
  isBare: boolean;
  isSubmodule: boolean;
};

async function discoverRepositories(roots: string[], maxDepth: number): Promise<DiscoveredRepository[]> {
  const results: DiscoveredRepository[] = [];
  for (const root of roots) {
    await walk(root, 0, maxDepth, results);
  }
  return results;
}

async function walk(current: string, depth: number, maxDepth: number, results: DiscoveredRepository[]) {
  const resolved = await resolveGitDirectory(current);
  if (resolved) {
    results.push({
      worktreePath: current,
      gitDir: resolved.gitDir,
      isBare: resolved.isBare,
      isSubmodule: resolved.isSubmodule
    });
  }
  if (depth >= maxDepth) {
    return;
  }
  let entries: Dirent[];
  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (DEFAULT_IGNORES.has(entry.name)) continue;
    await walk(path.join(current, entry.name), depth + 1, maxDepth, results);
  }
}

function dedupeRoots(roots: string[]) {
  const normalized = roots.map(root => path.resolve(root));
  return Array.from(new Set(normalized));
}
