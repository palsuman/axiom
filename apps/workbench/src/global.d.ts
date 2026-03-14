import type {
  CopyEntriesPayload,
  CreateEntryPayload,
  DeleteEntriesPayload,
  FsOperationResponse,
  GitCommitPayload,
  GitCommitResult,
  GitDiffRequest,
  GitDiffResponse,
  GitHistoryRequest,
  GitHistoryResponse,
  GitRepositoryInfo,
  GitStagePayload,
  GitStatusRequest,
  GitStatusSummary,
  MoveEntriesPayload,
  OpenWorkspacePayload,
  PickWorkspaceResponse,
  RecentWorkspaceEntry,
  RenameEntryPayload,
  TerminalCreatePayload,
  TerminalDataEvent,
  TerminalDescriptor,
  TerminalDisposePayload,
  TerminalExitEvent,
  TerminalResizePayload,
  TerminalWritePayload,
  UndoPayload
} from '@nexus/contracts/ipc';

type NexusBridge = {
  openWorkspace(payload: OpenWorkspacePayload): Promise<unknown>;
  getRecentWorkspaces(): Promise<RecentWorkspaceEntry[]>;
  pickWorkspaceFolder(): Promise<PickWorkspaceResponse>;
  fsCreateEntry(payload: CreateEntryPayload): Promise<FsOperationResponse>;
  fsRenameEntry(payload: RenameEntryPayload): Promise<FsOperationResponse>;
  fsMoveEntries(payload: MoveEntriesPayload): Promise<FsOperationResponse>;
  fsCopyEntries(payload: CopyEntriesPayload): Promise<FsOperationResponse>;
  fsDeleteEntries(payload: DeleteEntriesPayload): Promise<FsOperationResponse>;
  fsUndo(payload: UndoPayload): Promise<boolean>;
  gitListRepositories(): Promise<GitRepositoryInfo[]>;
  gitGetStatus(payload: GitStatusRequest): Promise<GitStatusSummary>;
  gitStage(payload: GitStagePayload): Promise<GitStatusSummary>;
  gitUnstage(payload: GitStagePayload): Promise<GitStatusSummary>;
  gitGetDiff(payload: GitDiffRequest): Promise<GitDiffResponse>;
  gitCommit(payload: GitCommitPayload): Promise<GitCommitResult>;
  gitGetHistory(payload: GitHistoryRequest): Promise<GitHistoryResponse>;
  terminalCreate(payload: TerminalCreatePayload): Promise<TerminalDescriptor>;
  terminalWrite(payload: TerminalWritePayload): Promise<void>;
  terminalResize(payload: TerminalResizePayload): Promise<void>;
  terminalDispose(payload: TerminalDisposePayload): Promise<void>;
  onTerminalData(listener: (event: TerminalDataEvent) => void): () => void;
  onTerminalExit(listener: (event: TerminalExitEvent) => void): () => void;
};

declare global {
  interface Window {
    nexus?: NexusBridge;
  }
}

export {};
