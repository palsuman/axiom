export type CoreChannel =
  | 'nexus:get-env'
  | 'nexus:log'
  | 'nexus:new-window'
  | 'nexus:get-window-session'
  | 'nexus:open-workspace'
  | 'nexus:get-recent-workspaces'
  | 'nexus:pick-workspace'
  | 'nexus:git:list-repositories'
  | 'nexus:git:get-status'
  | 'nexus:git:stage'
  | 'nexus:git:unstage'
  | 'nexus:git:get-diff'
  | 'nexus:git:commit'
  | 'nexus:git:get-history'
  | 'nexus:terminal:create'
  | 'nexus:terminal:write'
  | 'nexus:terminal:resize'
  | 'nexus:terminal:dispose'
  | 'nexus:terminal:data'
  | 'nexus:terminal:exit'
  | 'nexus:check-for-updates'
  | 'nexus:install-update'
  | 'nexus:fs:create'
  | 'nexus:fs:rename'
  | 'nexus:fs:move'
  | 'nexus:fs:copy'
  | 'nexus:fs:delete'
  | 'nexus:fs:undo'
  | 'nexus:workspace-backup:save'
  | 'nexus:workspace-backup:load'
  | 'nexus:workspace-backup:clear';

export type GetEnvResponse = {
  nexusEnv: string;
  logLevel: string;
};

export type LogPayload = {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
};

export type WindowSessionMetadata = {
  id: string;
  workspace?: string;
  lastOpenedAt: number;
  lastFocusedAt: number;
  workspaceLabel?: string;
  workspaceRoots?: string[];
  descriptorPath?: string;
};

export type GitHeadInfo = {
  detached: boolean;
  ref?: string;
  commit?: string;
};

export type GitRepositoryInfo = {
  id: string;
  worktreePath: string;
  gitDir: string;
  isBare: boolean;
  isSubmodule: boolean;
  head: GitHeadInfo;
  lastChangedAt: number;
};

export type GitFileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'untracked' | 'typechange' | 'merged';

export type GitStatusEntry = {
  path: string;
  originalPath?: string;
  staged?: GitFileStatus;
  worktree?: GitFileStatus;
  conflicted?: boolean;
};

export type GitStatusSummary = {
  repositoryId: string;
  worktreePath: string;
  branch?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  detached?: boolean;
  timestamp: number;
  entries: GitStatusEntry[];
};

export type GitStatusRequest = {
  repositoryId: string;
};

export type GitStagePayload = GitStatusRequest & {
  paths: string[];
};

export type GitDiffRequest = GitStatusRequest & {
  path: string;
  staged?: boolean;
};

export type GitDiffResponse = {
  repositoryId: string;
  path: string;
  staged: boolean;
  diff: string;
  summary: {
    additions: number;
    deletions: number;
  };
};

export type GitCommitPayload = {
  repositoryId: string;
  message: string;
  amend?: boolean;
  signOff?: boolean;
  allowEmpty?: boolean;
};

export type GitCommitResult = {
  repositoryId: string;
  commit: {
    sha: string;
    summary: string;
    body?: string;
    authorName: string;
    authorEmail: string;
    authorDate: number;
  };
  branch?: string;
};

export type GitHistoryRequest = {
  repositoryId: string;
  limit?: number;
  search?: string;
};

export type GitHistoryEntry = {
  sha: string;
  summary: string;
  body?: string;
  authorName: string;
  authorEmail: string;
  authorDate: number;
  committerName: string;
  committerEmail: string;
  committerDate: number;
  refs?: string[];
};

export type GitHistoryResponse = {
  repositoryId: string;
  entries: GitHistoryEntry[];
};

export type TerminalCreatePayload = {
  sessionId?: string;
  cols: number;
  rows: number;
  cwd?: string;
  shell?: string;
  env?: Record<string, string>;
};

export type TerminalDescriptor = {
  terminalId: string;
  pid: number;
  shell: string;
  cwd?: string;
};

export type TerminalWritePayload = {
  terminalId: string;
  data: string;
};

export type TerminalResizePayload = {
  terminalId: string;
  cols: number;
  rows: number;
};

export type TerminalDisposePayload = {
  terminalId: string;
};

export type TerminalDataEvent = {
  terminalId: string;
  data: string;
};

export type TerminalExitEvent = {
  terminalId: string;
  code: number;
  signal?: number;
};

export type OpenWorkspacePayload = {
  path: string;
  forceNew?: boolean;
};

export type RecentWorkspaceEntry = {
  path: string;
  label: string;
  lastOpenedAt: number;
  descriptorPath?: string;
  primary?: string;
  roots?: string[];
};

export type PickWorkspaceResponse = {
  path?: string;
};

export type UpdateStatusPayload = {
  status: 'checking' | 'available' | 'not-available' | 'download-progress' | 'downloaded' | 'error';
  info?: unknown;
};

export type FsEntryKind = 'file' | 'folder';

export type CreateEntryPayload = {
  path: string;
  kind: FsEntryKind;
  contents?: string;
};

export type RenameEntryPayload = {
  source: string;
  target: string;
  overwrite?: boolean;
};

export type MoveEntriesPayload = {
  entries: Array<{ source: string; target: string }>;
  overwrite?: boolean;
};

export type CopyEntriesPayload = {
  sources: string[];
  targetDirectory: string;
  overwrite?: boolean;
};

export type DeleteEntriesPayload = {
  paths: string[];
};

export type FsOperationResponse = {
  paths: string[];
  undoToken?: string;
};

export type UndoPayload = {
  token: string;
};

export type WorkspaceBackupDocument = {
  uri: string;
  value: string;
  languageId?: string;
  encoding?: string;
  eol?: string;
  dirty: boolean;
  lastSavedAt?: number;
  isReadonly?: boolean;
  version?: number;
  persistent?: boolean;
};

export type WorkspaceBackupTerminal = {
  terminalId: string;
  shell?: string;
  cwd?: string;
  buffer?: string;
  cols?: number;
  rows?: number;
  restoredAt?: number;
  lastUpdatedAt?: number;
};

export type WorkspaceBackupRunConfig = {
  id: string;
  label: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  lastUsedAt?: number;
};

export type WorkspaceBackupContent = {
  documents: WorkspaceBackupDocument[];
  terminals: WorkspaceBackupTerminal[];
  runConfigs: WorkspaceBackupRunConfig[];
};

export type WorkspaceBackupSavePayload = {
  workspaceId: string;
  snapshot: WorkspaceBackupContent;
};

export type WorkspaceBackupIdentifier = {
  workspaceId: string;
};

export type WorkspaceBackupSnapshot = WorkspaceBackupContent & {
  workspaceId: string;
  version: number;
  updatedAt: number;
  bytes: number;
};

export type WorkspaceBackupWriteResult = {
  workspaceId: string;
  bytes: number;
  documents: number;
  terminals: number;
  runConfigs: number;
  truncated?: boolean;
};
