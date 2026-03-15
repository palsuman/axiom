import fs from 'node:fs';
import path from 'node:path';
import type {
  TelemetryConsentCategoryDefinition,
  TelemetryConsentPreferences,
  TelemetryConsentRecord,
  TelemetryConsentSnapshot,
  TelemetryConsentUpdatePayload,
  TelemetryDeleteRequest,
  TelemetryDeleteResponse,
  TelemetryExportRequest,
  TelemetryExportResponse
} from '@nexus/contracts/ipc';
import type { NexusEnv } from '@nexus/platform/config/env';
import {
  DEFAULT_TELEMETRY_CONSENT_PREFERENCES,
  PrivacyConsentStore
} from '@nexus/platform/observability/privacy-consent-store';
import { TelemetryStore } from '@nexus/platform/observability/telemetry-store';

const PRIVACY_CATEGORIES: TelemetryConsentCategoryDefinition[] = [
  {
    key: 'usageTelemetry',
    title: 'Usage & diagnostics telemetry',
    description: 'Collect local diagnostics and usage events for startup, reliability, and feature health.'
  },
  {
    key: 'crashReports',
    title: 'Crash report sharing',
    description: 'Allow Nexus to offer sending anonymized crash reports when you explicitly choose the send action.'
  }
];

type PrivacyServiceOptions = {
  telemetryStore?: TelemetryStore;
  consentStore?: PrivacyConsentStore;
  now?: () => number;
  fsApi?: Pick<typeof fs, 'mkdirSync' | 'writeFileSync' | 'existsSync' | 'readdirSync' | 'rmSync'>;
};

export class PrivacyService {
  private readonly telemetryStore: TelemetryStore;
  private readonly consentStore: PrivacyConsentStore;
  private readonly now: () => number;
  private readonly fsApi: NonNullable<PrivacyServiceOptions['fsApi']>;
  private readonly exportDir: string;

  constructor(
    private readonly env: NexusEnv,
    options: PrivacyServiceOptions = {}
  ) {
    this.telemetryStore =
      options.telemetryStore ??
      new TelemetryStore({
        bufferPath: path.join(env.nexusDataDir ?? env.nexusHome, 'telemetry', 'events.jsonl')
      });
    this.consentStore =
      options.consentStore ??
      new PrivacyConsentStore({
        userConsentPath: path.join(env.nexusDataDir ?? env.nexusHome, 'privacy', 'user-consent.json'),
        workspaceConsentDir: path.join(env.workspaceDataDir, 'privacy-consent')
      });
    this.now = options.now ?? (() => Date.now());
    this.fsApi = options.fsApi ?? fs;
    this.exportDir = path.join(env.nexusDataDir ?? env.nexusHome, 'privacy', 'exports');
  }

  getSnapshot(workspaceId?: string): TelemetryConsentSnapshot {
    const user = this.consentStore.loadUserConsent();
    const workspace = workspaceId ? this.consentStore.loadWorkspaceConsent(workspaceId) : undefined;
    const effective = resolveEffectiveConsent(user, workspace, workspaceId);
    const health = this.telemetryStore.getHealth();

    return {
      workspaceId,
      categories: PRIVACY_CATEGORIES.map(category => ({ ...category })),
      user,
      workspace,
      effective,
      telemetry: {
        ...health,
        collectionEnabled: effective.preferences.usageTelemetry
      }
    };
  }

  updateConsent(payload: TelemetryConsentUpdatePayload): TelemetryConsentSnapshot {
    const updatedAt = this.now();
    if (payload.scope === 'workspace') {
      this.consentStore.saveWorkspaceConsent(payload.workspaceId ?? '', payload.preferences, updatedAt);
      return this.getSnapshot(payload.workspaceId);
    }
    this.consentStore.saveUserConsent(payload.preferences, updatedAt);
    return this.getSnapshot(payload.workspaceId);
  }

  exportData(request: TelemetryExportRequest = {}): TelemetryExportResponse {
    const exportedAt = this.now();
    const mode = request.mode ?? 'all';
    const snapshot = this.getSnapshot(request.workspaceId);
    const allRecords = this.telemetryStore.getAllRecords();
    const records =
      mode === 'workspace' && request.workspaceId
        ? allRecords.filter(record => record.workspaceId === request.workspaceId)
        : allRecords;
    const filePath = path.join(this.exportDir, `telemetry-export-${exportedAt}.json`);
    this.fsApi.mkdirSync(this.exportDir, { recursive: true });
    this.fsApi.writeFileSync(
      filePath,
      JSON.stringify(
        {
          exportedAt,
          mode,
          workspaceId: request.workspaceId,
          consent: snapshot,
          records
        },
        null,
        2
      ),
      'utf8'
    );

    return {
      path: filePath,
      recordCount: records.length,
      exportedAt,
      mode,
      workspaceId: request.workspaceId
    };
  }

  deleteData(request: TelemetryDeleteRequest = {}): TelemetryDeleteResponse {
    const cleared = this.telemetryStore.clear();
    if (request.deleteExports && this.fsApi.existsSync(this.exportDir)) {
      this.fsApi.readdirSync(this.exportDir).forEach(entry => {
        this.fsApi.rmSync(path.join(this.exportDir, entry), { force: true, recursive: true });
      });
    }
    return {
      deleted: true,
      clearedRecords: cleared.clearedRecords,
      bufferPath: cleared.bufferPath
    };
  }

  isTelemetryEnabled(workspaceId?: string) {
    return this.getSnapshot(workspaceId).effective.preferences.usageTelemetry;
  }

  canShareCrashReports(workspaceId?: string) {
    return this.getSnapshot(workspaceId).effective.preferences.crashReports;
  }
}

function resolveEffectiveConsent(
  user: TelemetryConsentRecord,
  workspace: TelemetryConsentRecord | undefined,
  workspaceId?: string
): TelemetryConsentRecord {
  const preferences: TelemetryConsentPreferences = workspace
    ? {
        usageTelemetry: workspace.preferences.usageTelemetry,
        crashReports: workspace.preferences.crashReports
      }
    : {
        ...user.preferences
      };

  return {
    scope: workspace ? 'workspace' : 'user',
    workspaceId,
    source: workspace?.source ?? user.source,
    updatedAt: workspace?.updatedAt ?? user.updatedAt,
    preferences
  };
}

export { PRIVACY_CATEGORIES, DEFAULT_TELEMETRY_CONSENT_PREFERENCES };
