import { contextBridge, ipcRenderer } from 'electron';
import { mountWorkbenchRenderer } from './workbench-renderer-loader';
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
  GetEnvResponse,
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
  LogPayload,
  MoveEntriesPayload,
  OpenWorkspacePayload,
  PickWorkspaceResponse,
  RecentWorkspaceEntry,
  RenameEntryPayload,
  RunConfigurationLoadResponse,
  RunConfigurationSaveResponse,
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
  UndoPayload,
  WindowSessionMetadata,
  WorkspaceBackupSavePayload,
  WorkspaceBackupSnapshot
} from '@nexus/contracts/ipc';

const terminalDataListeners = new Set<(event: TerminalDataEvent) => void>();
const terminalExitListeners = new Set<(event: TerminalExitEvent) => void>();
const debugEventListeners = new Set<(event: DebugSessionEvent) => void>();

ipcRenderer.on('nexus:terminal:data', (_event, payload: TerminalDataEvent) => {
  terminalDataListeners.forEach(listener => listener(payload));
});

ipcRenderer.on('nexus:terminal:exit', (_event, payload: TerminalExitEvent) => {
  terminalExitListeners.forEach(listener => listener(payload));
});

ipcRenderer.on('nexus:debug:event', (_event, payload: DebugSessionEvent) => {
  debugEventListeners.forEach(listener => listener(payload));
});

const api = {
  async getEnv(): Promise<GetEnvResponse> {
    return ipcRenderer.invoke('nexus:get-env');
  },
  log(payload: LogPayload) {
    ipcRenderer.send('nexus:log', payload);
  },
  async telemetryTrack(payload: TelemetryTrackPayload): Promise<TelemetryRecord> {
    return ipcRenderer.invoke('nexus:telemetry:track', payload);
  },
  async telemetryReplay(payload: TelemetryReplayRequest = {}): Promise<TelemetryReplayResponse> {
    return ipcRenderer.invoke('nexus:telemetry:replay', payload);
  },
  async telemetryGetHealth(): Promise<TelemetryHealthResponse> {
    return ipcRenderer.invoke('nexus:telemetry:health');
  },
  async featureFlagsList(): Promise<FeatureFlagSnapshot> {
    return ipcRenderer.invoke('nexus:feature-flags:list');
  },
  async openNewWindow() {
    return ipcRenderer.invoke('nexus:new-window');
  },
  async getWindowSession(): Promise<WindowSessionMetadata | undefined> {
    return ipcRenderer.invoke('nexus:get-window-session');
  },
  async openWorkspace(payload: OpenWorkspacePayload) {
    return ipcRenderer.invoke('nexus:open-workspace', payload);
  },
  async getRecentWorkspaces(): Promise<RecentWorkspaceEntry[]> {
    return ipcRenderer.invoke('nexus:get-recent-workspaces');
  },
  async pickWorkspaceFolder(): Promise<PickWorkspaceResponse> {
    return ipcRenderer.invoke('nexus:pick-workspace');
  },
  async fsCreateEntry(payload: CreateEntryPayload): Promise<FsOperationResponse> {
    return ipcRenderer.invoke('nexus:fs:create', payload);
  },
  async fsRenameEntry(payload: RenameEntryPayload): Promise<FsOperationResponse> {
    return ipcRenderer.invoke('nexus:fs:rename', payload);
  },
  async fsMoveEntries(payload: MoveEntriesPayload): Promise<FsOperationResponse> {
    return ipcRenderer.invoke('nexus:fs:move', payload);
  },
  async fsCopyEntries(payload: CopyEntriesPayload): Promise<FsOperationResponse> {
    return ipcRenderer.invoke('nexus:fs:copy', payload);
  },
  async fsDeleteEntries(payload: DeleteEntriesPayload): Promise<FsOperationResponse> {
    return ipcRenderer.invoke('nexus:fs:delete', payload);
  },
  async fsUndo(payload: UndoPayload): Promise<boolean> {
    return ipcRenderer.invoke('nexus:fs:undo', payload);
  },
  async runConfigLoad(): Promise<RunConfigurationLoadResponse> {
    return ipcRenderer.invoke('nexus:run-config:load');
  },
  async runConfigSave(text: string): Promise<RunConfigurationSaveResponse> {
    return ipcRenderer.invoke('nexus:run-config:save', { text });
  },
  async debugStart(payload: DebugSessionStartPayload = {}): Promise<DebugSessionSnapshot> {
    return ipcRenderer.invoke('nexus:debug:start', payload);
  },
  async debugStop(payload: DebugSessionStopPayload = {}): Promise<DebugSessionStopResponse> {
    return ipcRenderer.invoke('nexus:debug:stop', payload);
  },
  async debugEvaluate(payload: DebugEvaluatePayload): Promise<DebugEvaluateResponse> {
    return ipcRenderer.invoke('nexus:debug:evaluate', payload);
  },
  async gitListRepositories(): Promise<GitRepositoryInfo[]> {
    return ipcRenderer.invoke('nexus:git:list-repositories');
  },
  async gitGetStatus(payload: GitStatusRequest): Promise<GitStatusSummary> {
    return ipcRenderer.invoke('nexus:git:get-status', payload);
  },
  async gitStage(payload: GitStagePayload): Promise<GitStatusSummary> {
    return ipcRenderer.invoke('nexus:git:stage', payload);
  },
  async gitUnstage(payload: GitStagePayload): Promise<GitStatusSummary> {
    return ipcRenderer.invoke('nexus:git:unstage', payload);
  },
  async gitGetDiff(payload: GitDiffRequest): Promise<GitDiffResponse> {
    return ipcRenderer.invoke('nexus:git:get-diff', payload);
  },
  async gitCommit(payload: GitCommitPayload): Promise<GitCommitResult> {
    return ipcRenderer.invoke('nexus:git:commit', payload);
  },
  async gitGetHistory(payload: GitHistoryRequest): Promise<GitHistoryResponse> {
    return ipcRenderer.invoke('nexus:git:get-history', payload);
  },
  async terminalCreate(payload: TerminalCreatePayload): Promise<TerminalDescriptor> {
    return ipcRenderer.invoke('nexus:terminal:create', payload);
  },
  async terminalWrite(payload: TerminalWritePayload): Promise<void> {
    return ipcRenderer.invoke('nexus:terminal:write', payload);
  },
  async terminalResize(payload: TerminalResizePayload): Promise<void> {
    return ipcRenderer.invoke('nexus:terminal:resize', payload);
  },
  async terminalDispose(payload: TerminalDisposePayload): Promise<void> {
    return ipcRenderer.invoke('nexus:terminal:dispose', payload);
  },
  async workspaceBackupSave(payload: WorkspaceBackupSavePayload): Promise<WorkspaceBackupSnapshot> {
    return ipcRenderer.invoke('nexus:workspace-backup:save', payload);
  },
  async workspaceBackupLoad(workspaceId: string): Promise<WorkspaceBackupSnapshot | null> {
    return ipcRenderer.invoke('nexus:workspace-backup:load', { workspaceId });
  },
  async workspaceBackupClear(workspaceId: string): Promise<boolean> {
    return ipcRenderer.invoke('nexus:workspace-backup:clear', { workspaceId });
  },
  onTerminalData(listener: (event: TerminalDataEvent) => void) {
    terminalDataListeners.add(listener);
    return () => terminalDataListeners.delete(listener);
  },
  onTerminalExit(listener: (event: TerminalExitEvent) => void) {
    terminalExitListeners.add(listener);
    return () => terminalExitListeners.delete(listener);
  },
  onDebugEvent(listener: (event: DebugSessionEvent) => void) {
    debugEventListeners.add(listener);
    return () => debugEventListeners.delete(listener);
  }
};

contextBridge.exposeInMainWorld('nexus', api);
mountWorkbenchRenderer();

declare global {
  interface Window {
    nexus: typeof api;
  }
}
