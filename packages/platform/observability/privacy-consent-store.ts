import fs from 'node:fs';
import path from 'node:path';
import type {
  TelemetryConsentPreferences,
  TelemetryConsentRecord
} from '@nexus/contracts/ipc';
import { sanitizeWorkspaceId } from '@nexus/platform/workspace/workspace-paths';

const CONSENT_VERSION = 1;

export const DEFAULT_TELEMETRY_CONSENT_PREFERENCES: TelemetryConsentPreferences = {
  usageTelemetry: true,
  crashReports: false
};

type PersistedConsentDocument = {
  version: number;
  updatedAt: number;
  preferences: TelemetryConsentPreferences;
};

export class PrivacyConsentStore {
  constructor(
    private readonly paths: {
      userConsentPath: string;
      workspaceConsentDir: string;
    }
  ) {}

  loadUserConsent(): TelemetryConsentRecord {
    const record = this.loadConsent('user');
    if (!record) {
      return {
        scope: 'user',
        source: 'default',
        preferences: { ...DEFAULT_TELEMETRY_CONSENT_PREFERENCES }
      };
    }
    return record;
  }

  loadWorkspaceConsent(workspaceId: string): TelemetryConsentRecord | undefined {
    return this.loadConsent('workspace', workspaceId);
  }

  saveUserConsent(preferences: TelemetryConsentPreferences, updatedAt: number) {
    return this.saveConsent('user', preferences, updatedAt);
  }

  saveWorkspaceConsent(workspaceId: string, preferences: TelemetryConsentPreferences, updatedAt: number) {
    return this.saveConsent('workspace', preferences, updatedAt, workspaceId);
  }

  private loadConsent(scope: 'user' | 'workspace', workspaceId?: string): TelemetryConsentRecord | undefined {
    const filePath = this.resolvePath(scope, workspaceId);
    if (!fs.existsSync(filePath)) {
      return scope === 'user'
        ? {
            scope,
            source: 'default',
            preferences: { ...DEFAULT_TELEMETRY_CONSENT_PREFERENCES }
          }
        : undefined;
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as PersistedConsentDocument;
      if (parsed.version !== CONSENT_VERSION) {
        return scope === 'user'
          ? {
              scope,
              source: 'default',
              preferences: { ...DEFAULT_TELEMETRY_CONSENT_PREFERENCES }
            }
          : undefined;
      }
      return {
        scope,
        workspaceId,
        source: 'persisted',
        updatedAt: parsed.updatedAt,
        preferences: normalizePreferences(parsed.preferences)
      };
    } catch {
      return scope === 'user'
        ? {
            scope,
            source: 'default',
            preferences: { ...DEFAULT_TELEMETRY_CONSENT_PREFERENCES }
          }
        : undefined;
    }
  }

  private saveConsent(
    scope: 'user' | 'workspace',
    preferences: TelemetryConsentPreferences,
    updatedAt: number,
    workspaceId?: string
  ) {
    const filePath = this.resolvePath(scope, workspaceId);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          version: CONSENT_VERSION,
          updatedAt,
          preferences: normalizePreferences(preferences)
        } satisfies PersistedConsentDocument,
        null,
        2
      ),
      'utf8'
    );
    return {
      scope,
      workspaceId,
      source: 'persisted' as const,
      updatedAt,
      preferences: normalizePreferences(preferences)
    };
  }

  private resolvePath(scope: 'user' | 'workspace', workspaceId?: string) {
    if (scope === 'user') {
      return this.paths.userConsentPath;
    }
    if (!workspaceId?.trim()) {
      throw new Error('workspaceId is required for workspace telemetry consent');
    }
    return path.join(this.paths.workspaceConsentDir, `${sanitizeWorkspaceId(workspaceId)}.json`);
  }
}

function normalizePreferences(preferences: TelemetryConsentPreferences): TelemetryConsentPreferences {
  return {
    usageTelemetry: preferences.usageTelemetry !== false,
    crashReports: Boolean(preferences.crashReports)
  };
}
