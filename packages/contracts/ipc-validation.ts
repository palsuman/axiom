import type {
  LlamaControllerBenchmarkRequest,
  LlamaControllerHealthRequest,
  LlamaModelImportRequest,
  LlamaModelListRequest,
  LlamaControllerStartPayload,
  LlamaControllerStopPayload,
  CopyEntriesPayload,
  CreateEntryPayload,
  DebugSessionStartPayload,
  DebugSessionStopPayload,
  DebugEvaluatePayload,
  DeleteEntriesPayload,
  FsEntryKind,
  GitCommitPayload,
  GitDiffRequest,
  GitHistoryRequest,
  GitStagePayload,
  GitStatusRequest,
  LogPayload,
  MoveEntriesPayload,
  OpenWorkspacePayload,
  RunConfigurationSavePayload,
  RenameEntryPayload,
  TelemetryConsentRequest,
  TelemetryConsentUpdatePayload,
  TelemetryDeleteRequest,
  TelemetryExportRequest,
  TerminalCreatePayload,
  TerminalDisposePayload,
  TerminalResizePayload,
  TelemetryReplayRequest,
  TelemetryTrackPayload,
  TerminalWritePayload,
  UndoPayload,
  WorkspaceBackupContent,
  WorkspaceBackupDocument,
  WorkspaceBackupIdentifier,
  WorkspaceBackupRunConfig,
  WorkspaceBackupSavePayload,
  WorkspaceBackupTerminal
} from './ipc';

type PayloadValidator<T> = (payload: unknown) => T;

export class IpcValidationError extends Error {
  readonly channel: string;
  readonly issues: string[];

  constructor(channel: string, issues: string[]) {
    super(`Invalid payload for ${channel}: ${issues.join('; ')}`);
    this.name = 'IpcValidationError';
    this.channel = channel;
    this.issues = issues;
  }
}

const GIT_STATUS_VALUES = new Set([
  'added',
  'modified',
  'deleted',
  'renamed',
  'copied',
  'untracked',
  'typechange',
  'merged'
]);

const TELEMETRY_LEVELS = ['error', 'warn', 'info', 'debug'] as const;
const TELEMETRY_SCOPES = ['main', 'renderer', 'preload', 'shared'] as const;

const payloadValidators = {
  'nexus:log': (payload: unknown): LogPayload => {
    const value = asObject(payload, 'payload');
    return {
      level: readEnum(value, 'level', ['error', 'warn', 'info', 'debug']),
      message: readString(value, 'message', { minLength: 1 })
    };
  },
  'nexus:telemetry:track': (payload: unknown): TelemetryTrackPayload => {
    const value = asObject(payload, 'payload');
    return {
      name: readString(value, 'name', { minLength: 1 }),
      scope: readEnum(value, 'scope', TELEMETRY_SCOPES),
      level: readEnum(value, 'level', TELEMETRY_LEVELS, { optional: true }),
      message: readString(value, 'message', { optional: true, allowEmpty: false }),
      attributes: readTelemetryAttributeRecord(value, 'attributes', { optional: true }),
      measurements: readNumberRecord(value, 'measurements', { optional: true, min: 0 }),
      tags: readStringArray(value, 'tags', { optional: true }),
      timestamp: readInteger(value, 'timestamp', { optional: true, min: 0 }),
      sessionId: readString(value, 'sessionId', { optional: true, allowEmpty: false }),
      workspaceId: readString(value, 'workspaceId', { optional: true, allowEmpty: false })
    };
  },
  'nexus:telemetry:replay': (payload: unknown): TelemetryReplayRequest => {
    const value = asObject(payload, 'payload');
    return {
      limit: readInteger(value, 'limit', { optional: true, min: 1, max: 500 }),
      scope: readEnum(value, 'scope', TELEMETRY_SCOPES, { optional: true }),
      level: readEnum(value, 'level', TELEMETRY_LEVELS, { optional: true }),
      name: readString(value, 'name', { optional: true, allowEmpty: false })
    };
  },
  'nexus:privacy:get-consent': (payload: unknown): TelemetryConsentRequest => {
    const value = asObject(payload, 'payload');
    return {
      workspaceId: readString(value, 'workspaceId', { optional: true, allowEmpty: false })
    };
  },
  'nexus:privacy:update-consent': (payload: unknown): TelemetryConsentUpdatePayload => {
    const value = asObject(payload, 'payload');
    const scope = readEnum(value, 'scope', ['user', 'workspace'] as const);
    return {
      scope,
      workspaceId:
        scope === 'workspace'
          ? readString(value, 'workspaceId', { allowEmpty: false })
          : readString(value, 'workspaceId', { optional: true, allowEmpty: false }),
      preferences: readTelemetryConsentPreferences(value, 'preferences')
    };
  },
  'nexus:privacy:export-data': (payload: unknown): TelemetryExportRequest => {
    const value = asObject(payload, 'payload');
    return {
      workspaceId: readString(value, 'workspaceId', { optional: true, allowEmpty: false }),
      mode: readEnum(value, 'mode', ['all', 'workspace'] as const, { optional: true })
    };
  },
  'nexus:privacy:delete-data': (payload: unknown): TelemetryDeleteRequest => {
    const value = asObject(payload, 'payload');
    return {
      deleteExports: readBoolean(value, 'deleteExports', { optional: true })
    };
  },
  'nexus:ai:controller:health': (payload: unknown): LlamaControllerHealthRequest => {
    const value = asObject(payload, 'payload');
    return {
      refresh: readBoolean(value, 'refresh', { optional: true })
    };
  },
  'nexus:ai:controller:start': (payload: unknown): LlamaControllerStartPayload => {
    const value = asObject(payload, 'payload');
    return {
      modelPath: readString(value, 'modelPath', { minLength: 1 }),
      host: readString(value, 'host', { optional: true, allowEmpty: false }),
      port: readInteger(value, 'port', { optional: true, min: 1, max: 65535 }),
      threads: readInteger(value, 'threads', { optional: true, min: 1, max: 512 }),
      contextSize: readInteger(value, 'contextSize', { optional: true, min: 256, max: 1048576 }),
      batchSize: readInteger(value, 'batchSize', { optional: true, min: 1, max: 65535 }),
      gpuPreference: readEnum(value, 'gpuPreference', ['auto', 'cpu', 'gpu'] as const, { optional: true }),
      gpuLayers: readInteger(value, 'gpuLayers', { optional: true, min: 0, max: 999 }),
      restartOnCrash: readBoolean(value, 'restartOnCrash', { optional: true }),
      extraArgs: readStringArray(value, 'extraArgs', { optional: true })
    };
  },
  'nexus:ai:controller:stop': (payload: unknown): LlamaControllerStopPayload => {
    const value = asObject(payload, 'payload');
    return {
      force: readBoolean(value, 'force', { optional: true })
    };
  },
  'nexus:ai:controller:benchmark': (payload: unknown): LlamaControllerBenchmarkRequest => {
    const value = asObject(payload, 'payload');
    return {
      iterations: readInteger(value, 'iterations', { optional: true, min: 1, max: 100 }),
      warmupIterations: readInteger(value, 'warmupIterations', { optional: true, min: 0, max: 20 })
    };
  },
  'nexus:ai:model:list': (payload: unknown): LlamaModelListRequest => {
    const value = asObject(payload, 'payload');
    return {
      refresh: readBoolean(value, 'refresh', { optional: true })
    };
  },
  'nexus:ai:model:import': (payload: unknown): LlamaModelImportRequest => {
    const value = asObject(payload, 'payload');
    return {
      sourcePath: readString(value, 'sourcePath', { minLength: 1 }),
      mode: readEnum(value, 'mode', ['copy', 'move'] as const, { optional: true }),
      label: readString(value, 'label', { optional: true, allowEmpty: false })
    };
  },
  'nexus:open-workspace': (payload: unknown): OpenWorkspacePayload => {
    const value = asObject(payload, 'payload');
    return {
      path: readString(value, 'path', { minLength: 1 }),
      forceNew: readBoolean(value, 'forceNew', { optional: true })
    };
  },
  'nexus:git:get-status': (payload: unknown): GitStatusRequest => {
    const value = asObject(payload, 'payload');
    return {
      repositoryId: readString(value, 'repositoryId', { minLength: 1 })
    };
  },
  'nexus:git:stage': (payload: unknown): GitStagePayload => {
    const value = asObject(payload, 'payload');
    return {
      repositoryId: readString(value, 'repositoryId', { minLength: 1 }),
      paths: readStringArray(value, 'paths', { minItems: 1 })
    };
  },
  'nexus:git:unstage': (payload: unknown): GitStagePayload => {
    const value = asObject(payload, 'payload');
    return {
      repositoryId: readString(value, 'repositoryId', { minLength: 1 }),
      paths: readStringArray(value, 'paths', { minItems: 1 })
    };
  },
  'nexus:git:get-diff': (payload: unknown): GitDiffRequest => {
    const value = asObject(payload, 'payload');
    return {
      repositoryId: readString(value, 'repositoryId', { minLength: 1 }),
      path: readString(value, 'path', { minLength: 1 }),
      staged: readBoolean(value, 'staged', { optional: true })
    };
  },
  'nexus:git:commit': (payload: unknown): GitCommitPayload => {
    const value = asObject(payload, 'payload');
    return {
      repositoryId: readString(value, 'repositoryId', { minLength: 1 }),
      message: readString(value, 'message', { minLength: 1 }),
      amend: readBoolean(value, 'amend', { optional: true }),
      signOff: readBoolean(value, 'signOff', { optional: true }),
      allowEmpty: readBoolean(value, 'allowEmpty', { optional: true })
    };
  },
  'nexus:git:get-history': (payload: unknown): GitHistoryRequest => {
    const value = asObject(payload, 'payload');
    return {
      repositoryId: readString(value, 'repositoryId', { minLength: 1 }),
      limit: readInteger(value, 'limit', { optional: true, min: 1, max: 500 }),
      search: readString(value, 'search', { optional: true, allowEmpty: false })
    };
  },
  'nexus:terminal:create': (payload: unknown): TerminalCreatePayload => {
    const value = asObject(payload, 'payload');
    return {
      sessionId: readString(value, 'sessionId', { optional: true, allowEmpty: false }),
      cols: readInteger(value, 'cols', { min: 1, max: 500 }),
      rows: readInteger(value, 'rows', { min: 1, max: 500 }),
      cwd: readString(value, 'cwd', { optional: true, allowEmpty: false }),
      shell: readString(value, 'shell', { optional: true, allowEmpty: false }),
      env: readStringRecord(value, 'env', { optional: true })
    };
  },
  'nexus:terminal:write': (payload: unknown): TerminalWritePayload => {
    const value = asObject(payload, 'payload');
    return {
      terminalId: readString(value, 'terminalId', { minLength: 1 }),
      data: readString(value, 'data', { minLength: 1, trim: false })
    };
  },
  'nexus:terminal:resize': (payload: unknown): TerminalResizePayload => {
    const value = asObject(payload, 'payload');
    return {
      terminalId: readString(value, 'terminalId', { minLength: 1 }),
      cols: readInteger(value, 'cols', { min: 1, max: 500 }),
      rows: readInteger(value, 'rows', { min: 1, max: 500 })
    };
  },
  'nexus:terminal:dispose': (payload: unknown): TerminalDisposePayload => {
    const value = asObject(payload, 'payload');
    return {
      terminalId: readString(value, 'terminalId', { minLength: 1 })
    };
  },
  'nexus:fs:create': (payload: unknown): CreateEntryPayload => {
    const value = asObject(payload, 'payload');
    return {
      path: readString(value, 'path', { minLength: 1 }),
      kind: readEnum(value, 'kind', ['file', 'folder'] satisfies FsEntryKind[]),
      contents: readString(value, 'contents', { optional: true, trim: false })
    };
  },
  'nexus:fs:rename': (payload: unknown): RenameEntryPayload => {
    const value = asObject(payload, 'payload');
    return {
      source: readString(value, 'source', { minLength: 1 }),
      target: readString(value, 'target', { minLength: 1 }),
      overwrite: readBoolean(value, 'overwrite', { optional: true })
    };
  },
  'nexus:fs:move': (payload: unknown): MoveEntriesPayload => {
    const value = asObject(payload, 'payload');
    return {
      entries: readObjectArray(value, 'entries', { minItems: 1 }).map((entry, index) => ({
        source: readString(entry, 'source', { minLength: 1, label: `entries[${index}].source` }),
        target: readString(entry, 'target', { minLength: 1, label: `entries[${index}].target` })
      })),
      overwrite: readBoolean(value, 'overwrite', { optional: true })
    };
  },
  'nexus:fs:copy': (payload: unknown): CopyEntriesPayload => {
    const value = asObject(payload, 'payload');
    return {
      sources: readStringArray(value, 'sources', { minItems: 1 }),
      targetDirectory: readString(value, 'targetDirectory', { minLength: 1 }),
      overwrite: readBoolean(value, 'overwrite', { optional: true })
    };
  },
  'nexus:fs:delete': (payload: unknown): DeleteEntriesPayload => {
    const value = asObject(payload, 'payload');
    return {
      paths: readStringArray(value, 'paths', { minItems: 1 })
    };
  },
  'nexus:fs:undo': (payload: unknown): UndoPayload => {
    const value = asObject(payload, 'payload');
    return {
      token: readString(value, 'token', { minLength: 1 })
    };
  },
  'nexus:run-config:save': (payload: unknown): RunConfigurationSavePayload => {
    const value = asObject(payload, 'payload');
    return {
      text: readString(value, 'text', { trim: false })
    };
  },
  'nexus:debug:start': (payload: unknown): DebugSessionStartPayload => {
    const value = asObject(payload, 'payload');
    const breakpointEntries = Object.prototype.hasOwnProperty.call(value, 'breakpoints')
      ? readObjectArray(value, 'breakpoints')
      : undefined;
    return {
      configurationName: readString(value, 'configurationName', { optional: true, allowEmpty: false }),
      configurationIndex: readInteger(value, 'configurationIndex', { optional: true, min: 0 }),
      stopOnEntry: readBoolean(value, 'stopOnEntry', { optional: true }),
      breakpoints: breakpointEntries?.map((entry, index) => ({
        source: readString(entry, 'source', { minLength: 1, label: `breakpoints[${index}].source` }),
        lines: readIntegerArray(entry, 'lines', { minItems: 1, min: 1, label: `breakpoints[${index}].lines` })
      }))
    };
  },
  'nexus:debug:stop': (payload: unknown): DebugSessionStopPayload => {
    const value = asObject(payload, 'payload');
    return {
      sessionId: readString(value, 'sessionId', { optional: true, allowEmpty: false }),
      terminateDebuggee: readBoolean(value, 'terminateDebuggee', { optional: true })
    };
  },
  'nexus:debug:evaluate': (payload: unknown): DebugEvaluatePayload => {
    const value = asObject(payload, 'payload');
    return {
      sessionId: readString(value, 'sessionId', { optional: true, allowEmpty: false }),
      frameId: readInteger(value, 'frameId', { optional: true, min: 1 }),
      expression: readString(value, 'expression', { minLength: 1, allowEmpty: false }),
      context: readEnum(value, 'context', ['watch', 'repl', 'hover'] as const, { optional: true })
    };
  },
  'nexus:workspace-backup:save': (payload: unknown): WorkspaceBackupSavePayload => {
    const value = asObject(payload, 'payload');
    return {
      workspaceId: readString(value, 'workspaceId', { minLength: 1 }),
      snapshot: validateWorkspaceBackupContent(readObject(value, 'snapshot'))
    };
  },
  'nexus:workspace-backup:load': (payload: unknown): WorkspaceBackupIdentifier => {
    const value = asObject(payload, 'payload');
    return {
      workspaceId: readString(value, 'workspaceId', { minLength: 1 })
    };
  },
  'nexus:workspace-backup:clear': (payload: unknown): WorkspaceBackupIdentifier => {
    const value = asObject(payload, 'payload');
    return {
      workspaceId: readString(value, 'workspaceId', { minLength: 1 })
    };
  }
} satisfies Record<string, PayloadValidator<unknown>>;

export type ValidatedIpcChannel = keyof typeof payloadValidators;

export type IpcPayloadFor<C extends ValidatedIpcChannel> = ReturnType<(typeof payloadValidators)[C]>;

export function validateIpcPayload<C extends ValidatedIpcChannel>(channel: C, payload: unknown): IpcPayloadFor<C> {
  try {
    return payloadValidators[channel](payload) as IpcPayloadFor<C>;
  } catch (error) {
    if (error instanceof IpcValidationError) {
      throw new IpcValidationError(channel, error.issues);
    }
    throw error;
  }
}

export function isIpcValidationError(error: unknown): error is IpcValidationError {
  return error instanceof IpcValidationError;
}

function validateWorkspaceBackupContent(payload: Record<string, unknown>): WorkspaceBackupContent {
  return {
    documents: readObjectArray(payload, 'documents').map((entry, index) => validateWorkspaceBackupDocument(entry, index)),
    terminals: readObjectArray(payload, 'terminals').map((entry, index) => validateWorkspaceBackupTerminal(entry, index)),
    runConfigs: readObjectArray(payload, 'runConfigs').map((entry, index) => validateWorkspaceBackupRunConfig(entry, index))
  };
}

function validateWorkspaceBackupDocument(entry: Record<string, unknown>, index: number): WorkspaceBackupDocument {
  return {
    uri: readString(entry, 'uri', { minLength: 1, label: `documents[${index}].uri` }),
    value: readString(entry, 'value', { trim: false, label: `documents[${index}].value` }),
    languageId: readString(entry, 'languageId', {
      optional: true,
      allowEmpty: false,
      label: `documents[${index}].languageId`
    }),
    encoding: readString(entry, 'encoding', {
      optional: true,
      allowEmpty: false,
      label: `documents[${index}].encoding`
    }),
    eol: readString(entry, 'eol', { optional: true, allowEmpty: false, label: `documents[${index}].eol` }),
    dirty: readBoolean(entry, 'dirty', { label: `documents[${index}].dirty` }),
    lastSavedAt: readNumber(entry, 'lastSavedAt', { optional: true, min: 0, label: `documents[${index}].lastSavedAt` }),
    isReadonly: readBoolean(entry, 'isReadonly', { optional: true, label: `documents[${index}].isReadonly` }),
    version: readInteger(entry, 'version', { optional: true, min: 0, label: `documents[${index}].version` }),
    persistent: readBoolean(entry, 'persistent', { optional: true, label: `documents[${index}].persistent` })
  };
}

function validateWorkspaceBackupTerminal(entry: Record<string, unknown>, index: number): WorkspaceBackupTerminal {
  return {
    terminalId: readString(entry, 'terminalId', { minLength: 1, label: `terminals[${index}].terminalId` }),
    shell: readString(entry, 'shell', { optional: true, allowEmpty: false, label: `terminals[${index}].shell` }),
    cwd: readString(entry, 'cwd', { optional: true, allowEmpty: false, label: `terminals[${index}].cwd` }),
    buffer: readString(entry, 'buffer', { optional: true, trim: false, label: `terminals[${index}].buffer` }),
    cols: readInteger(entry, 'cols', { optional: true, min: 1, max: 500, label: `terminals[${index}].cols` }),
    rows: readInteger(entry, 'rows', { optional: true, min: 1, max: 500, label: `terminals[${index}].rows` }),
    restoredAt: readNumber(entry, 'restoredAt', { optional: true, min: 0, label: `terminals[${index}].restoredAt` }),
    lastUpdatedAt: readNumber(entry, 'lastUpdatedAt', {
      optional: true,
      min: 0,
      label: `terminals[${index}].lastUpdatedAt`
    })
  };
}

function validateWorkspaceBackupRunConfig(entry: Record<string, unknown>, index: number): WorkspaceBackupRunConfig {
  return {
    id: readString(entry, 'id', { minLength: 1, label: `runConfigs[${index}].id` }),
    label: readString(entry, 'label', { minLength: 1, label: `runConfigs[${index}].label` }),
    command: readString(entry, 'command', { minLength: 1, label: `runConfigs[${index}].command` }),
    args: readStringArray(entry, 'args', { optional: true, label: `runConfigs[${index}].args` }),
    cwd: readString(entry, 'cwd', { optional: true, allowEmpty: false, label: `runConfigs[${index}].cwd` }),
    env: readStringRecord(entry, 'env', { optional: true, label: `runConfigs[${index}].env` }),
    lastUsedAt: readNumber(entry, 'lastUsedAt', { optional: true, min: 0, label: `runConfigs[${index}].lastUsedAt` })
  };
}

function asObject(value: unknown, label: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new IpcValidationError(label, [`${label} must be an object`]);
  }
  return value as Record<string, unknown>;
}

function readObject(value: Record<string, unknown>, key: string, label = key) {
  return asObject(value[key], label);
}

function readString(
  value: Record<string, unknown>,
  key: string,
  options?: { optional?: false; allowEmpty?: boolean; minLength?: number; trim?: boolean; label?: string }
): string;
function readString(
  value: Record<string, unknown>,
  key: string,
  options: { optional: true; allowEmpty?: boolean; minLength?: number; trim?: boolean; label?: string }
): string | undefined;
function readString(
  value: Record<string, unknown>,
  key: string,
  options: { optional?: boolean; allowEmpty?: boolean; minLength?: number; trim?: boolean; label?: string } = {}
) {
  const label = options.label ?? key;
  const raw = value[key];
  if (raw === undefined || raw === null) {
    if (options.optional) {
      return undefined;
    }
    throw new IpcValidationError(label, [`${label} is required`]);
  }
  if (typeof raw !== 'string') {
    throw new IpcValidationError(label, [`${label} must be a string`]);
  }
  const normalized = options.trim === false ? raw : raw.trim();
  if (!options.allowEmpty && normalized.length === 0) {
    throw new IpcValidationError(label, [`${label} must not be empty`]);
  }
  if (options.minLength !== undefined && normalized.length < options.minLength) {
    throw new IpcValidationError(label, [`${label} must be at least ${options.minLength} characters`]);
  }
  return normalized;
}

function readBoolean(
  value: Record<string, unknown>,
  key: string,
  options?: { optional?: false; label?: string }
): boolean;
function readBoolean(
  value: Record<string, unknown>,
  key: string,
  options: { optional: true; label?: string }
): boolean | undefined;
function readBoolean(value: Record<string, unknown>, key: string, options: { optional?: boolean; label?: string } = {}) {
  const label = options.label ?? key;
  const raw = value[key];
  if (raw === undefined || raw === null) {
    if (options.optional) {
      return undefined;
    }
    throw new IpcValidationError(label, [`${label} is required`]);
  }
  if (typeof raw !== 'boolean') {
    throw new IpcValidationError(label, [`${label} must be a boolean`]);
  }
  return raw;
}

function readNumber(
  value: Record<string, unknown>,
  key: string,
  options?: { optional?: false; min?: number; max?: number; label?: string }
): number;
function readNumber(
  value: Record<string, unknown>,
  key: string,
  options: { optional: true; min?: number; max?: number; label?: string }
): number | undefined;
function readNumber(
  value: Record<string, unknown>,
  key: string,
  options: { optional?: boolean; min?: number; max?: number; label?: string } = {}
) {
  const label = options.label ?? key;
  const raw = value[key];
  if (raw === undefined || raw === null) {
    if (options.optional) {
      return undefined;
    }
    throw new IpcValidationError(label, [`${label} is required`]);
  }
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new IpcValidationError(label, [`${label} must be a finite number`]);
  }
  if (options.min !== undefined && raw < options.min) {
    throw new IpcValidationError(label, [`${label} must be >= ${options.min}`]);
  }
  if (options.max !== undefined && raw > options.max) {
    throw new IpcValidationError(label, [`${label} must be <= ${options.max}`]);
  }
  return raw;
}

function readInteger(
  value: Record<string, unknown>,
  key: string,
  options?: { optional?: false; min?: number; max?: number; label?: string }
): number;
function readInteger(
  value: Record<string, unknown>,
  key: string,
  options: { optional: true; min?: number; max?: number; label?: string }
): number | undefined;
function readInteger(
  value: Record<string, unknown>,
  key: string,
  options: { optional?: boolean; min?: number; max?: number; label?: string } = {}
) {
  const label = options.label ?? key;
  const raw = value[key];
  if (raw === undefined || raw === null) {
    if (options.optional) {
      return undefined;
    }
    throw new IpcValidationError(label, [`${label} is required`]);
  }
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new IpcValidationError(label, [`${label} must be a finite number`]);
  }
  if (options.min !== undefined && raw < options.min) {
    throw new IpcValidationError(label, [`${label} must be >= ${options.min}`]);
  }
  if (options.max !== undefined && raw > options.max) {
    throw new IpcValidationError(label, [`${label} must be <= ${options.max}`]);
  }
  if (raw === undefined) {
    return undefined;
  }
  if (!Number.isInteger(raw)) {
    throw new IpcValidationError(label, [`${label} must be an integer`]);
  }
  return raw;
}

function readEnum<T extends string>(
  value: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  options?: { optional?: false; label?: string }
): T;
function readEnum<T extends string>(
  value: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  options: { optional: true; label?: string }
): T | undefined;
function readEnum<T extends string>(
  value: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  options: { optional?: boolean; label?: string } = {}
) {
  const label = options.label ?? key;
  const rawValue = value[key];
  if (rawValue === undefined || rawValue === null) {
    if (options.optional) {
      return undefined;
    }
    throw new IpcValidationError(label, [`${label} is required`]);
  }
  if (typeof rawValue !== 'string') {
    throw new IpcValidationError(label, [`${label} must be a string`]);
  }
  const raw = rawValue.trim() as T;
  if (!raw) {
    throw new IpcValidationError(label, [`${label} must not be empty`]);
  }
  if (raw === undefined) {
    return undefined;
  }
  if (!allowed.includes(raw)) {
    throw new IpcValidationError(label, [`${label} must be one of ${allowed.join(', ')}`]);
  }
  return raw;
}

function readStringArray(
  value: Record<string, unknown>,
  key: string,
  options?: { optional?: false; minItems?: number; label?: string }
): string[];
function readStringArray(
  value: Record<string, unknown>,
  key: string,
  options: { optional: true; minItems?: number; label?: string }
): string[] | undefined;
function readStringArray(
  value: Record<string, unknown>,
  key: string,
  options: { optional?: boolean; minItems?: number; label?: string } = {}
) {
  const label = options.label ?? key;
  const raw = value[key];
  if (raw === undefined || raw === null) {
    if (options.optional) {
      return undefined;
    }
    throw new IpcValidationError(label, [`${label} is required`]);
  }
  if (!Array.isArray(raw)) {
    throw new IpcValidationError(label, [`${label} must be an array`]);
  }
  const normalized = raw.map((item, index) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new IpcValidationError(label, [`${label}[${index}] must be a non-empty string`]);
    }
    return item.trim();
  });
  if (options.minItems !== undefined && normalized.length < options.minItems) {
    throw new IpcValidationError(label, [`${label} must contain at least ${options.minItems} item(s)`]);
  }
  return normalized;
}

function readIntegerArray(
  value: Record<string, unknown>,
  key: string,
  options?: { optional?: false; minItems?: number; min?: number; max?: number; label?: string }
): number[];
function readIntegerArray(
  value: Record<string, unknown>,
  key: string,
  options: { optional: true; minItems?: number; min?: number; max?: number; label?: string }
): number[] | undefined;
function readIntegerArray(
  value: Record<string, unknown>,
  key: string,
  options: { optional?: boolean; minItems?: number; min?: number; max?: number; label?: string } = {}
) {
  const label = options.label ?? key;
  const raw = value[key];
  if (raw === undefined || raw === null) {
    if (options.optional) {
      return undefined;
    }
    throw new IpcValidationError(label, [`${label} is required`]);
  }
  if (!Array.isArray(raw)) {
    throw new IpcValidationError(label, [`${label} must be an array`]);
  }
  const normalized = raw.map((item, index) => {
    if (typeof item !== 'number' || !Number.isFinite(item) || !Number.isInteger(item)) {
      throw new IpcValidationError(label, [`${label}[${index}] must be an integer`]);
    }
    if (options.min !== undefined && item < options.min) {
      throw new IpcValidationError(label, [`${label}[${index}] must be >= ${options.min}`]);
    }
    if (options.max !== undefined && item > options.max) {
      throw new IpcValidationError(label, [`${label}[${index}] must be <= ${options.max}`]);
    }
    return item;
  });
  if (options.minItems !== undefined && normalized.length < options.minItems) {
    throw new IpcValidationError(label, [`${label} must contain at least ${options.minItems} item(s)`]);
  }
  return normalized;
}

function readObjectArray(
  value: Record<string, unknown>,
  key: string,
  options: { optional?: boolean; minItems?: number } = {}
) {
  const raw = value[key];
  if (raw === undefined || raw === null) {
    if (options.optional) {
      return [];
    }
    throw new IpcValidationError(key, [`${key} is required`]);
  }
  if (!Array.isArray(raw)) {
    throw new IpcValidationError(key, [`${key} must be an array`]);
  }
  if (options.minItems !== undefined && raw.length < options.minItems) {
    throw new IpcValidationError(key, [`${key} must contain at least ${options.minItems} item(s)`]);
  }
  return raw.map((item, index) => asObject(item, `${key}[${index}]`));
}

function readStringRecord(
  value: Record<string, unknown>,
  key: string,
  options?: { optional?: false; label?: string }
): Record<string, string>;
function readStringRecord(
  value: Record<string, unknown>,
  key: string,
  options: { optional: true; label?: string }
): Record<string, string> | undefined;
function readStringRecord(
  value: Record<string, unknown>,
  key: string,
  options: { optional?: boolean; label?: string } = {}
) {
  const label = options.label ?? key;
  const raw = value[key];
  if (raw === undefined || raw === null) {
    if (options.optional) {
      return undefined;
    }
    throw new IpcValidationError(label, [`${label} is required`]);
  }
  const record = asObject(raw, label);
  const normalized: Record<string, string> = {};
  Object.entries(record).forEach(([recordKey, recordValue]) => {
    if (typeof recordValue !== 'string') {
      throw new IpcValidationError(label, [`${label}.${recordKey} must be a string`]);
    }
    normalized[recordKey] = recordValue;
  });
  return normalized;
}

function readNumberRecord(
  value: Record<string, unknown>,
  key: string,
  options?: { optional?: false; min?: number; max?: number; label?: string }
): Record<string, number>;
function readNumberRecord(
  value: Record<string, unknown>,
  key: string,
  options: { optional: true; min?: number; max?: number; label?: string }
): Record<string, number> | undefined;
function readNumberRecord(
  value: Record<string, unknown>,
  key: string,
  options: { optional?: boolean; min?: number; max?: number; label?: string } = {}
) {
  const label = options.label ?? key;
  const raw = value[key];
  if (raw === undefined || raw === null) {
    if (options.optional) {
      return undefined;
    }
    throw new IpcValidationError(label, [`${label} is required`]);
  }
  const record = asObject(raw, label);
  const normalized: Record<string, number> = {};
  Object.entries(record).forEach(([recordKey, recordValue]) => {
    if (typeof recordValue !== 'number' || !Number.isFinite(recordValue)) {
      throw new IpcValidationError(label, [`${label}.${recordKey} must be a finite number`]);
    }
    if (options.min !== undefined && recordValue < options.min) {
      throw new IpcValidationError(label, [`${label}.${recordKey} must be >= ${options.min}`]);
    }
    if (options.max !== undefined && recordValue > options.max) {
      throw new IpcValidationError(label, [`${label}.${recordKey} must be <= ${options.max}`]);
    }
    normalized[recordKey] = recordValue;
  });
  return normalized;
}

function readTelemetryAttributeRecord(
  value: Record<string, unknown>,
  key: string,
  options?: { optional?: false; label?: string }
): Record<string, string | number | boolean | null>;
function readTelemetryAttributeRecord(
  value: Record<string, unknown>,
  key: string,
  options: { optional: true; label?: string }
): Record<string, string | number | boolean | null> | undefined;
function readTelemetryAttributeRecord(
  value: Record<string, unknown>,
  key: string,
  options: { optional?: boolean; label?: string } = {}
) {
  const label = options.label ?? key;
  const raw = value[key];
  if (raw === undefined || raw === null) {
    if (options.optional) {
      return undefined;
    }
    throw new IpcValidationError(label, [`${label} is required`]);
  }
  const record = asObject(raw, label);
  const normalized: Record<string, string | number | boolean | null> = {};
  Object.entries(record).forEach(([recordKey, recordValue]) => {
    if (
      recordValue !== null &&
      typeof recordValue !== 'string' &&
      typeof recordValue !== 'number' &&
      typeof recordValue !== 'boolean'
    ) {
      throw new IpcValidationError(label, [
        `${label}.${recordKey} must be a string, number, boolean, or null`
      ]);
    }
    if (typeof recordValue === 'number' && !Number.isFinite(recordValue)) {
      throw new IpcValidationError(label, [`${label}.${recordKey} must be a finite number`]);
    }
    normalized[recordKey] = recordValue;
  });
  return normalized;
}

function readTelemetryConsentPreferences(value: Record<string, unknown>, key: string) {
  const record = asObject(value[key], key);
  return {
    usageTelemetry: readBoolean(record, 'usageTelemetry'),
    crashReports: readBoolean(record, 'crashReports')
  };
}

export function isGitStatusValue(value: string | undefined) {
  return value !== undefined && GIT_STATUS_VALUES.has(value);
}
