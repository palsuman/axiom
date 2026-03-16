export type CoreChannel =
  | 'nexus:get-env'
  | 'nexus:log'
  | 'nexus:telemetry:track'
  | 'nexus:telemetry:replay'
  | 'nexus:telemetry:health'
  | 'nexus:privacy:get-consent'
  | 'nexus:privacy:update-consent'
  | 'nexus:privacy:export-data'
  | 'nexus:privacy:delete-data'
  | 'nexus:feature-flags:list'
  | 'nexus:ai:controller:health'
  | 'nexus:ai:controller:start'
  | 'nexus:ai:controller:stop'
  | 'nexus:ai:controller:benchmark'
  | 'nexus:ai:model:list'
  | 'nexus:ai:model:import'
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
  | 'nexus:run-config:load'
  | 'nexus:run-config:save'
  | 'nexus:debug:start'
  | 'nexus:debug:stop'
  | 'nexus:debug:evaluate'
  | 'nexus:debug:event'
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

export type TelemetryScope = 'main' | 'renderer' | 'preload' | 'shared';

export type TelemetryLevel = 'error' | 'warn' | 'info' | 'debug';

export type TelemetryAttributeValue = string | number | boolean | null;

export type TelemetryTrackPayload = {
  name: string;
  scope: TelemetryScope;
  level?: TelemetryLevel;
  message?: string;
  attributes?: Record<string, TelemetryAttributeValue>;
  measurements?: Record<string, number>;
  tags?: string[];
  timestamp?: number;
  sessionId?: string;
  workspaceId?: string;
};

export type TelemetryRecord = {
  sequence: number;
  recordedAt: number;
  name: string;
  scope: TelemetryScope;
  level: TelemetryLevel;
  message?: string;
  attributes: Record<string, TelemetryAttributeValue>;
  measurements: Record<string, number>;
  tags: string[];
  sessionId?: string;
  workspaceId?: string;
};

export type TelemetryReplayRequest = {
  limit?: number;
  scope?: TelemetryScope;
  level?: TelemetryLevel;
  name?: string;
};

export type TelemetryReplayResponse = {
  records: TelemetryRecord[];
  totalBuffered: number;
  dropped: number;
  bufferPath: string;
};

export type TelemetryHealthResponse = {
  bufferPath: string;
  eventCount: number;
  fileBytes: number;
  dropped: number;
  lastSequence: number;
  oldestRecordedAt?: number;
  newestRecordedAt?: number;
  levels: Record<TelemetryLevel, number>;
  scopes: Record<TelemetryScope, number>;
};

export type TelemetryConsentScope = 'user' | 'workspace';

export type TelemetryConsentCategoryKey = 'usageTelemetry' | 'crashReports';

export type TelemetryConsentPreferences = Record<TelemetryConsentCategoryKey, boolean>;

export type TelemetryConsentSource = 'default' | 'persisted';

export type TelemetryConsentCategoryDefinition = {
  key: TelemetryConsentCategoryKey;
  title: string;
  description: string;
};

export type TelemetryConsentRecord = {
  scope: TelemetryConsentScope;
  workspaceId?: string;
  source: TelemetryConsentSource;
  updatedAt?: number;
  preferences: TelemetryConsentPreferences;
};

export type TelemetryConsentSnapshot = {
  workspaceId?: string;
  categories: TelemetryConsentCategoryDefinition[];
  user: TelemetryConsentRecord;
  workspace?: TelemetryConsentRecord;
  effective: TelemetryConsentRecord;
  telemetry: TelemetryHealthResponse & {
    collectionEnabled: boolean;
  };
};

export type TelemetryConsentRequest = {
  workspaceId?: string;
};

export type TelemetryConsentUpdatePayload = {
  scope: TelemetryConsentScope;
  workspaceId?: string;
  preferences: TelemetryConsentPreferences;
};

export type TelemetryExportRequest = {
  workspaceId?: string;
  mode?: 'all' | 'workspace';
};

export type TelemetryExportResponse = {
  path: string;
  recordCount: number;
  exportedAt: number;
  mode: 'all' | 'workspace';
  workspaceId?: string;
};

export type TelemetryDeleteRequest = {
  deleteExports?: boolean;
};

export type TelemetryDeleteResponse = {
  deleted: boolean;
  clearedRecords: number;
  bufferPath: string;
};

export type FeatureFlagStage = 'stable' | 'preview' | 'internal';

export type FeatureFlagReason = 'default' | 'override' | 'rollout' | 'kill-switch';

export type FeatureFlagEvaluation = {
  key: string;
  description: string;
  stage: FeatureFlagStage;
  enabledByDefault: boolean;
  enabled: boolean;
  reason: FeatureFlagReason;
  bucket: number;
  rolloutPercentage?: number;
  killSwitch: boolean;
  sources: string[];
};

export type FeatureFlagSnapshot = {
  flags: FeatureFlagEvaluation[];
  activeKeys: string[];
  summary: string;
  sources: string[];
  unknownFlags: string[];
  loadErrors: string[];
  configPath?: string;
  remoteUrl?: string;
  remoteLoadedAt?: number;
};

export type LlamaControllerStatus = 'stopped' | 'starting' | 'running' | 'degraded' | 'restarting' | 'crashed';

export type LlamaGpuPreference = 'auto' | 'cpu' | 'gpu';

export type LlamaControllerStartPayload = {
  modelPath: string;
  host?: string;
  port?: number;
  threads?: number;
  contextSize?: number;
  batchSize?: number;
  gpuPreference?: LlamaGpuPreference;
  gpuLayers?: number;
  restartOnCrash?: boolean;
  extraArgs?: string[];
};

export type LlamaControllerStopPayload = {
  force?: boolean;
};

export type LlamaControllerHealthRequest = {
  refresh?: boolean;
};

export type LlamaControllerProcessState = {
  pid?: number;
  startedAt?: number;
  restarts: number;
  restartOnCrash: boolean;
  lastExitCode?: number;
  lastExitSignal?: string;
  lastExitAt?: number;
};

export type LlamaControllerHealthResult = {
  ok: boolean;
  checkedAt: number;
  latencyMs?: number;
  statusCode?: number;
  error?: string;
};

export type LlamaControllerHealthResponse = {
  status: LlamaControllerStatus;
  installRoot: string;
  binaryPath?: string;
  installed: boolean;
  endpoint: string;
  host: string;
  port: number;
  modelPath?: string;
  process: LlamaControllerProcessState;
  health: LlamaControllerHealthResult;
  configuration?: {
    threads?: number;
    contextSize?: number;
    batchSize?: number;
    gpuPreference: LlamaGpuPreference;
    gpuLayers?: number;
    extraArgs: string[];
  };
  recentOutput: string[];
};

export type LlamaControllerBenchmarkRequest = {
  iterations?: number;
  warmupIterations?: number;
};

export type LlamaControllerBenchmarkSample = {
  iteration: number;
  ok: boolean;
  checkedAt: number;
  latencyMs?: number;
  statusCode?: number;
  error?: string;
};

export type LlamaControllerBenchmarkSummary = {
  successes: number;
  failures: number;
  minLatencyMs?: number;
  maxLatencyMs?: number;
  avgLatencyMs?: number;
  p50LatencyMs?: number;
  p95LatencyMs?: number;
};

export type LlamaControllerBenchmarkResponse = {
  iterations: number;
  warmupIterations: number;
  endpoint: string;
  samples: LlamaControllerBenchmarkSample[];
  summary: LlamaControllerBenchmarkSummary;
};

export type LlamaModelListRequest = {
  refresh?: boolean;
};

export type LlamaModelImportMode = 'copy' | 'move';

export type LlamaModelImportRequest = {
  sourcePath: string;
  mode?: LlamaModelImportMode;
  label?: string;
};

export type LlamaModelSource = 'discovered' | 'imported';

export type LlamaModelRecord = {
  id: string;
  path: string;
  relativePath: string;
  fileName: string;
  displayName: string;
  source: LlamaModelSource;
  format: 'gguf';
  sizeBytes: number;
  modifiedAt: number;
  importedAt?: number;
  sourcePath?: string;
  family?: string;
  parameterScale?: string;
  quantization?: string;
  ready: boolean;
  issues: string[];
};

export type LlamaModelListResponse = {
  modelRoot: string;
  registryPath: string;
  discoveredAt: number;
  models: LlamaModelRecord[];
};

export type LlamaModelImportResponse = {
  modelRoot: string;
  imported: LlamaModelRecord[];
  skipped: string[];
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

export type RunConfigurationIssue = {
  path: string;
  message: string;
};

export type RunConfigurationLoadResponse = {
  path: string;
  exists: boolean;
  text: string;
  issues: RunConfigurationIssue[];
};

export type RunConfigurationSavePayload = {
  text: string;
};

export type RunConfigurationSaveResponse = {
  path: string;
  saved: boolean;
  text: string;
  issues: RunConfigurationIssue[];
};

export type DebugBreakpointPayload = {
  source: string;
  lines: number[];
};

export type DebugSessionStartPayload = {
  configurationName?: string;
  configurationIndex?: number;
  stopOnEntry?: boolean;
  breakpoints?: DebugBreakpointPayload[];
};

export type DebugSessionStopPayload = {
  sessionId?: string;
  terminateDebuggee?: boolean;
};

export type DebugEvaluatePayload = {
  sessionId?: string;
  frameId?: number;
  expression: string;
  context?: 'watch' | 'repl' | 'hover';
};

export type DebugSource = {
  name?: string;
  path?: string;
};

export type DebugStackFrame = {
  id: number;
  name: string;
  source?: DebugSource;
  line: number;
  column: number;
};

export type DebugSessionState = 'starting' | 'running' | 'stopped' | 'terminated' | 'failed';

export type DebugSessionSnapshot = {
  sessionId: string;
  workspaceSessionId: string;
  ownerWebContentsId: number;
  configurationName: string;
  adapterType: string;
  request: 'launch' | 'attach';
  startedAt: number;
  state: DebugSessionState;
  reason?: string;
  threadId?: number;
  stackFrames: DebugStackFrame[];
};

export type DebugSessionStopResponse = {
  sessionId: string;
  stopped: boolean;
  state: DebugSessionState;
};

export type DebugEvaluateResponse = {
  sessionId: string;
  frameId?: number;
  expression: string;
  result: string;
  type?: string;
};

export type DebugOutputEvent = {
  category: 'stdout' | 'stderr' | 'console';
  output: string;
};

export type DebugSessionEvent = {
  sessionId: string;
  kind: 'started' | 'stopped' | 'continued' | 'terminated' | 'output' | 'error';
  timestamp: number;
  snapshot?: DebugSessionSnapshot;
  output?: DebugOutputEvent;
  message?: string;
};
