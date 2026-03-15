import type {
  TelemetryConsentPreferences,
  TelemetryConsentSnapshot,
  TelemetryConsentUpdatePayload,
  TelemetryDeleteResponse,
  TelemetryExportResponse
} from '@nexus/contracts/ipc';
import { resolveNexusBridge } from '../boot/nexus-bridge-resolver';
import type { WorkbenchShell } from '../shell/workbench-shell';

type PrivacyBridge =
  | {
      privacyGetConsent(payload?: { workspaceId?: string }): Promise<TelemetryConsentSnapshot>;
      privacyUpdateConsent(payload: TelemetryConsentUpdatePayload): Promise<TelemetryConsentSnapshot>;
      privacyExportData(payload?: {
        workspaceId?: string;
        mode?: 'all' | 'workspace';
      }): Promise<TelemetryExportResponse>;
      privacyDeleteData(payload?: { deleteExports?: boolean }): Promise<TelemetryDeleteResponse>;
    }
  | undefined;

export type PrivacyCenterSnapshot = {
  readonly editorResource: string;
  readonly workspaceId?: string;
  readonly consent?: TelemetryConsentSnapshot;
  readonly loading: boolean;
  readonly error?: string;
  readonly lastExport?: TelemetryExportResponse;
  readonly lastDelete?: TelemetryDeleteResponse;
};

type Listener = (snapshot: PrivacyCenterSnapshot) => void;

export class PrivacyCenterService {
  private readonly shell?: WorkbenchShell;
  private readonly bridge: PrivacyBridge;
  private readonly workspaceId?: string;
  private readonly listeners = new Set<Listener>();
  private snapshot: PrivacyCenterSnapshot;

  constructor(options: { shell?: WorkbenchShell; bridge?: PrivacyBridge; workspaceId?: string } = {}) {
    this.shell = options.shell;
    this.bridge = options.bridge ?? PrivacyCenterService.resolveBridge();
    this.workspaceId = options.workspaceId;
    this.snapshot = {
      editorResource: buildPrivacyEditorResource(),
      workspaceId: this.workspaceId,
      loading: false
    };
  }

  async open() {
    await this.refresh();
    const snapshot = this.getSnapshot();
    this.shell?.openEditor({
      title: 'Privacy Center',
      resource: snapshot.editorResource,
      kind: 'text'
    });
    this.emit(snapshot);
    return snapshot;
  }

  async refresh() {
    if (!this.bridge) {
      return this.updateSnapshot({
        consent: undefined,
        loading: false,
        error: 'Privacy bridge is unavailable'
      });
    }
    this.updateSnapshot({
      loading: true,
      error: undefined
    });
    try {
      const consent = await this.bridge.privacyGetConsent({
        workspaceId: this.workspaceId
      });
      return this.updateSnapshot({
        consent,
        loading: false,
        error: undefined
      });
    } catch (error) {
      return this.updateSnapshot({
        loading: false,
        error: readError(error)
      });
    }
  }

  async updateConsent(scope: 'user' | 'workspace', preferences: TelemetryConsentPreferences) {
    if (!this.bridge) {
      throw new Error('Privacy bridge is unavailable');
    }
    this.updateSnapshot({
      loading: true,
      error: undefined
    });
    try {
      const consent = await this.bridge.privacyUpdateConsent({
        scope,
        workspaceId: scope === 'workspace' ? this.workspaceId : undefined,
        preferences
      });
      return this.updateSnapshot({
        consent,
        loading: false,
        error: undefined
      });
    } catch (error) {
      return this.updateSnapshot({
        loading: false,
        error: readError(error)
      });
    }
  }

  async exportData(mode: 'all' | 'workspace' = 'all') {
    if (!this.bridge) {
      throw new Error('Privacy bridge is unavailable');
    }
    this.updateSnapshot({
      loading: true,
      error: undefined
    });
    try {
      const lastExport = await this.bridge.privacyExportData({
        workspaceId: this.workspaceId,
        mode
      });
      const consent = await this.bridge.privacyGetConsent({
        workspaceId: this.workspaceId
      });
      return this.updateSnapshot({
        consent,
        lastExport,
        loading: false,
        error: undefined
      });
    } catch (error) {
      return this.updateSnapshot({
        loading: false,
        error: readError(error)
      });
    }
  }

  async deleteData(deleteExports = true) {
    if (!this.bridge) {
      throw new Error('Privacy bridge is unavailable');
    }
    this.updateSnapshot({
      loading: true,
      error: undefined
    });
    try {
      const lastDelete = await this.bridge.privacyDeleteData({ deleteExports });
      const consent = await this.bridge.privacyGetConsent({
        workspaceId: this.workspaceId
      });
      return this.updateSnapshot({
        consent,
        lastDelete,
        loading: false,
        error: undefined
      });
    } catch (error) {
      return this.updateSnapshot({
        loading: false,
        error: readError(error)
      });
    }
  }

  getSnapshot() {
    return {
      ...this.snapshot,
      consent: this.snapshot.consent ? cloneConsentSnapshot(this.snapshot.consent) : undefined,
      lastExport: this.snapshot.lastExport ? { ...this.snapshot.lastExport } : undefined,
      lastDelete: this.snapshot.lastDelete ? { ...this.snapshot.lastDelete } : undefined
    };
  }

  onDidChange(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private updateSnapshot(update: Partial<PrivacyCenterSnapshot>) {
    this.snapshot = {
      ...this.snapshot,
      ...update
    };
    const snapshot = this.getSnapshot();
    this.emit(snapshot);
    return snapshot;
  }

  private emit(snapshot: PrivacyCenterSnapshot) {
    this.listeners.forEach(listener => listener(snapshot));
  }

  private static resolveBridge(): PrivacyBridge {
    const bridge = resolveNexusBridge<NonNullable<PrivacyBridge>>();
    if (
      bridge &&
      typeof bridge.privacyGetConsent === 'function' &&
      typeof bridge.privacyUpdateConsent === 'function' &&
      typeof bridge.privacyExportData === 'function' &&
      typeof bridge.privacyDeleteData === 'function'
    ) {
      return bridge;
    }
    return undefined;
  }
}

function buildPrivacyEditorResource() {
  return 'privacy://center';
}

function cloneConsentSnapshot(snapshot: TelemetryConsentSnapshot): TelemetryConsentSnapshot {
  return {
    ...snapshot,
    categories: snapshot.categories.map(category => ({ ...category })),
    user: {
      ...snapshot.user,
      preferences: { ...snapshot.user.preferences }
    },
    workspace: snapshot.workspace
      ? {
          ...snapshot.workspace,
          preferences: { ...snapshot.workspace.preferences }
        }
      : undefined,
    effective: {
      ...snapshot.effective,
      preferences: { ...snapshot.effective.preferences }
    },
    telemetry: {
      ...snapshot.telemetry,
      levels: { ...snapshot.telemetry.levels },
      scopes: { ...snapshot.telemetry.scopes }
    }
  };
}

function readError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
