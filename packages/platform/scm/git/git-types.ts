import type { GitHeadInfo } from '@nexus/contracts/ipc';

export type GitRepository = {
  id: string;
  worktreePath: string;
  gitDir: string;
  isBare: boolean;
  isSubmodule: boolean;
  head: GitHeadInfo;
  lastChangedAt: number;
};

export type GitDiscoveryOptions = {
  maxDepth?: number;
};
