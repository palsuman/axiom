import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_TELEMETRY_CONSENT_PREFERENCES,
  PrivacyConsentStore
} from './privacy-consent-store';

describe('PrivacyConsentStore', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-privacy-consent-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns a default user consent record when nothing is persisted', () => {
    const store = new PrivacyConsentStore({
      userConsentPath: path.join(tempDir, 'privacy', 'user.json'),
      workspaceConsentDir: path.join(tempDir, 'privacy', 'workspaces')
    });

    expect(store.loadUserConsent()).toEqual({
      scope: 'user',
      source: 'default',
      preferences: DEFAULT_TELEMETRY_CONSENT_PREFERENCES
    });
  });

  it('persists and reloads user and workspace consent records', () => {
    const store = new PrivacyConsentStore({
      userConsentPath: path.join(tempDir, 'privacy', 'user.json'),
      workspaceConsentDir: path.join(tempDir, 'privacy', 'workspaces')
    });

    store.saveUserConsent(
      {
        usageTelemetry: false,
        crashReports: true
      },
      100
    );
    store.saveWorkspaceConsent(
      'Workspace One',
      {
        usageTelemetry: true,
        crashReports: true
      },
      200
    );

    expect(store.loadUserConsent()).toEqual({
      scope: 'user',
      source: 'persisted',
      updatedAt: 100,
      preferences: {
        usageTelemetry: false,
        crashReports: true
      }
    });
    expect(store.loadWorkspaceConsent('Workspace One')).toEqual({
      scope: 'workspace',
      workspaceId: 'Workspace One',
      source: 'persisted',
      updatedAt: 200,
      preferences: {
        usageTelemetry: true,
        crashReports: true
      }
    });
  });
});
