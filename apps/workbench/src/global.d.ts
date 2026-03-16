import type {
  CopyEntriesPayload,
  CreateEntryPayload,
  DebugSessionEvent,
  DebugEvaluatePayload,
  DebugEvaluateResponse,
  DebugSessionSnapshot,
  DebugSessionStartPayload,
  DebugSessionStopPayload,
  DebugSessionStopResponse,
  DeleteEntriesPayload,
  FsOperationResponse,
  FeatureFlagSnapshot,
  LlamaControllerBenchmarkRequest,
  LlamaControllerBenchmarkResponse,
  LlamaControllerHealthRequest,
  LlamaControllerHealthResponse,
  LlamaModelImportRequest,
  LlamaModelImportResponse,
  LlamaModelListRequest,
  LlamaModelListResponse,
  LlamaControllerStartPayload,
  LlamaControllerStopPayload,
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
  RunConfigurationLoadResponse,
  RunConfigurationSaveResponse,
  TelemetryConsentRequest,
  TelemetryConsentSnapshot,
  TelemetryConsentUpdatePayload,
  TelemetryDeleteRequest,
  TelemetryDeleteResponse,
  TelemetryExportRequest,
  TelemetryExportResponse,
  TelemetryHealthResponse,
  TelemetryRecord,
  TelemetryReplayRequest,
  TelemetryReplayResponse,
  TelemetryTrackPayload,
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
  telemetryTrack(payload: TelemetryTrackPayload): Promise<TelemetryRecord>;
  telemetryReplay(payload?: TelemetryReplayRequest): Promise<TelemetryReplayResponse>;
  telemetryGetHealth(): Promise<TelemetryHealthResponse>;
  privacyGetConsent(payload?: TelemetryConsentRequest): Promise<TelemetryConsentSnapshot>;
  privacyUpdateConsent(payload: TelemetryConsentUpdatePayload): Promise<TelemetryConsentSnapshot>;
  privacyExportData(payload?: TelemetryExportRequest): Promise<TelemetryExportResponse>;
  privacyDeleteData(payload?: TelemetryDeleteRequest): Promise<TelemetryDeleteResponse>;
  featureFlagsList(): Promise<FeatureFlagSnapshot>;
  aiControllerGetHealth(payload?: LlamaControllerHealthRequest): Promise<LlamaControllerHealthResponse>;
  aiControllerStart(payload: LlamaControllerStartPayload): Promise<LlamaControllerHealthResponse>;
  aiControllerStop(payload?: LlamaControllerStopPayload): Promise<LlamaControllerHealthResponse>;
  aiControllerBenchmark(payload?: LlamaControllerBenchmarkRequest): Promise<LlamaControllerBenchmarkResponse>;
  aiModelList(payload?: LlamaModelListRequest): Promise<LlamaModelListResponse>;
  aiModelImport(payload: LlamaModelImportRequest): Promise<LlamaModelImportResponse>;
  fsCreateEntry(payload: CreateEntryPayload): Promise<FsOperationResponse>;
  fsRenameEntry(payload: RenameEntryPayload): Promise<FsOperationResponse>;
  fsMoveEntries(payload: MoveEntriesPayload): Promise<FsOperationResponse>;
  fsCopyEntries(payload: CopyEntriesPayload): Promise<FsOperationResponse>;
  fsDeleteEntries(payload: DeleteEntriesPayload): Promise<FsOperationResponse>;
  fsUndo(payload: UndoPayload): Promise<boolean>;
  runConfigLoad(): Promise<RunConfigurationLoadResponse>;
  runConfigSave(text: string): Promise<RunConfigurationSaveResponse>;
  debugStart(payload?: DebugSessionStartPayload): Promise<DebugSessionSnapshot>;
  debugStop(payload?: DebugSessionStopPayload): Promise<DebugSessionStopResponse>;
  debugEvaluate(payload: DebugEvaluatePayload): Promise<DebugEvaluateResponse>;
  onDebugEvent(listener: (event: DebugSessionEvent) => void): () => void;
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

  var __NEXUS_PRELOAD_BRIDGE__: NexusBridge | undefined;
}

export {};
