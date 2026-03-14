import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

import type { GitHeadInfo } from '@nexus/contracts/ipc';

export type ResolvedGitDirectory = {
  gitDir: string;
  isBare: boolean;
  isSubmodule: boolean;
};

export async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export function createRepositoryId(worktreePath: string) {
  return createHash('sha1').update(path.resolve(worktreePath)).digest('hex');
}

export async function resolveGitDirectory(worktreePath: string): Promise<ResolvedGitDirectory | null> {
  const candidate = path.join(worktreePath, '.git');
  const stats = await safeStat(candidate);
  if (stats?.isDirectory()) {
    return { gitDir: candidate, isBare: false, isSubmodule: false };
  }
  if (stats?.isFile()) {
    const contents = await fs.readFile(candidate, 'utf8');
    const match = contents.match(/gitdir:\s*(.+)/i);
    if (!match) {
      return null;
    }
    const resolved = path.resolve(worktreePath, match[1].trim());
    return { gitDir: resolved, isBare: false, isSubmodule: true };
  }
  const headPath = path.join(worktreePath, 'HEAD');
  if (await pathExists(headPath)) {
    return { gitDir: worktreePath, isBare: true, isSubmodule: false };
  }
  return null;
}

export async function readHeadInfo(gitDir: string): Promise<GitHeadInfo> {
  try {
    const headPath = path.join(gitDir, 'HEAD');
    const headContents = (await fs.readFile(headPath, 'utf8')).trim();
    if (headContents.startsWith('ref:')) {
      const ref = headContents.slice(4).trim();
      const refPath = path.join(gitDir, ref);
      const commit = (await fs.readFile(refPath, 'utf8')).trim();
      return { detached: false, ref, commit };
    }
    return { detached: true, commit: headContents };
  } catch {
    return { detached: true };
  }
}

async function safeStat(target: string) {
  try {
    return await fs.stat(target);
  } catch {
    return null;
  }
}
