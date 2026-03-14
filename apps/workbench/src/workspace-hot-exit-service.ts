import type {
  WorkspaceBackupContent,
  WorkspaceBackupDocument,
  WorkspaceBackupRunConfig,
  WorkspaceBackupSnapshot,
  WorkspaceBackupTerminal,
  WorkspaceBackupSavePayload,
  WorkspaceBackupIdentifier
} from '@nexus/contracts/ipc';
import type { TextModelManager, TextDocumentSnapshot } from './editor/text-model-manager';
import type { TerminalHost } from './terminal-host';

type WorkspaceBackupBridge = {
  saveSnapshot(payload: WorkspaceBackupSavePayload): Promise<WorkspaceBackupSnapshot>;
  loadSnapshot(payload: WorkspaceBackupIdentifier): Promise<WorkspaceBackupSnapshot | null>;
  clearSnapshot(payload: WorkspaceBackupIdentifier): Promise<boolean>;
};

export type WorkspaceHotExitServiceOptions = {
  workspaceId: string;
  modelManager?: TextModelManager;
  terminalHost?: TerminalHost;
  runConfigs?: WorkspaceBackupRunConfig[];
  debounceMs?: number;
  bridge?: WorkspaceBackupBridge;
};

export class WorkspaceHotExitService {
  private readonly workspaceId: string;
  private readonly debounceMs: number;
  private readonly bridge?: WorkspaceBackupBridge;
  private flushTimer?: NodeJS.Timeout;
  private disposed = false;
  private modelManager?: TextModelManager;
  private terminalHost?: TerminalHost;
  private modelSubscription?: () => void;
  private terminalSubscription?: () => void;
  private runConfigSnapshot: WorkspaceBackupRunConfig[] = [];
  private readonly readyPromise: Promise<void>;

  constructor(options: WorkspaceHotExitServiceOptions) {
    this.workspaceId = options.workspaceId;
    this.debounceMs = options.debounceMs ?? 750;
    this.bridge = options.bridge ?? resolveDefaultBridge();
    this.runConfigSnapshot = options.runConfigs ?? [];
    if (options.modelManager) {
      this.attachModelManager(options.modelManager);
    }
    if (options.terminalHost) {
      this.attachTerminalHost(options.terminalHost);
    }
    this.readyPromise = this.restoreFromBackup().catch(error => {
      console.warn('[hot-exit] failed to restore snapshot', error);
    });
  }

  whenReady() {
    return this.readyPromise;
  }

  attachModelManager(manager: TextModelManager) {
    if (this.modelManager === manager) return;
    this.modelSubscription?.();
    this.modelManager = manager;
    this.modelSubscription = manager.onDidChange(() => this.scheduleFlush());
  }

  attachTerminalHost(host: TerminalHost) {
    if (this.terminalHost === host) return;
    this.terminalSubscription?.();
    this.terminalHost = host;
    this.terminalSubscription = host.onBufferChange(() => this.scheduleFlush());
  }

  setRunConfigurations(configs: WorkspaceBackupRunConfig[]) {
    this.runConfigSnapshot = configs;
    this.scheduleFlush();
  }

  async flushNow() {
    if (this.disposed || !this.bridge) return;
    const payload = this.buildSnapshotPayload();
    if (!payload.documents.length && !payload.terminals.length && !payload.runConfigs.length) {
      await this.bridge.clearSnapshot({ workspaceId: this.workspaceId });
      return;
    }
    await this.bridge.saveSnapshot({ workspaceId: this.workspaceId, snapshot: payload });
  }

  dispose() {
    this.disposed = true;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.modelSubscription?.();
    this.terminalSubscription?.();
  }

  private async restoreFromBackup() {
    if (!this.bridge) return;
    const snapshot = await this.bridge.loadSnapshot({ workspaceId: this.workspaceId });
    if (!snapshot) return;
    await this.restoreDocuments(snapshot.documents);
    this.restoreTerminal(snapshot.terminals);
    if (snapshot.runConfigs.length) {
      this.runConfigSnapshot = snapshot.runConfigs;
    }
  }

  private async restoreDocuments(documents: WorkspaceBackupDocument[]) {
    if (!this.modelManager || !documents.length) return;
    for (const entry of documents) {
      await this.modelManager.openDocument({
        uri: entry.uri,
        languageId: entry.languageId,
        encoding: (entry.encoding as any) ?? 'utf8',
        eol: (entry.eol as any) ?? '\n',
        persistent: entry.persistent ?? true,
        initialValue: entry.value,
        isReadonly: entry.isReadonly
      });
      this.modelManager.applyContentSnapshot(entry.uri, entry.value, { markDirty: entry.dirty });
    }
  }

  private restoreTerminal(terminals: WorkspaceBackupTerminal[]) {
    if (!this.terminalHost || !terminals.length) return;
    this.terminalHost.restoreFromSnapshot(terminals[0]);
  }

  private scheduleFlush() {
    if (!this.bridge || this.disposed) return;
    if (this.debounceMs === 0) {
      void this.flushNow();
      return;
    }
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      void this.flushNow();
    }, this.debounceMs);
  }

  private buildSnapshotPayload(): WorkspaceBackupContent {
    return {
      documents: this.collectDirtyDocuments(),
      terminals: this.collectTerminalSnapshots(),
      runConfigs: this.runConfigSnapshot
    };
  }

  private collectDirtyDocuments(): WorkspaceBackupDocument[] {
    if (!this.modelManager) {
      return [];
    }
    return this.modelManager
      .listOpenDocuments()
      .filter(doc => doc.dirty || doc.persistent === false)
      .map(mapDocument);
  }

  private collectTerminalSnapshots(): WorkspaceBackupTerminal[] {
    if (!this.terminalHost) return [];
    const snapshot = this.terminalHost.captureSnapshot();
    return snapshot ? [snapshot] : [];
  }
}

type NexusBackupApi = {
  workspaceBackupSave?: (payload: WorkspaceBackupSavePayload) => Promise<WorkspaceBackupSnapshot>;
  workspaceBackupLoad?: (workspaceId: string) => Promise<WorkspaceBackupSnapshot | null>;
  workspaceBackupClear?: (workspaceId: string) => Promise<boolean>;
};

function resolveDefaultBridge(): WorkspaceBackupBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  const api = (window as typeof window & { nexus?: NexusBackupApi }).nexus;
  if (!api?.workspaceBackupSave || !api.workspaceBackupLoad || !api.workspaceBackupClear) {
    return undefined;
  }
  return {
    saveSnapshot: payload => api.workspaceBackupSave!(payload),
    loadSnapshot: payload => api.workspaceBackupLoad!(payload.workspaceId),
    clearSnapshot: payload => api.workspaceBackupClear!(payload.workspaceId)
  };
}

function mapDocument(snapshot: TextDocumentSnapshot): WorkspaceBackupDocument {
  return {
    uri: snapshot.uri,
    value: snapshot.value,
    languageId: snapshot.languageId,
    encoding: snapshot.encoding,
    eol: snapshot.eol,
    dirty: snapshot.dirty,
    lastSavedAt: snapshot.lastSavedAt,
    isReadonly: snapshot.isReadonly,
    version: snapshot.version,
    persistent: snapshot.persistent
  };
}
