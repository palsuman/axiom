import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TelemetryStore } from '@nexus/platform/observability/telemetry-store';
import { createMockEnv } from '../test-utils/mock-env';
import { PrivacyService } from './privacy-service';

describe('PrivacyService', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-privacy-service-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('resolves user and workspace consent snapshots', () => {
    const env = createMockEnv({
      nexusDataDir: tempDir,
      workspaceDataDir: path.join(tempDir, 'workspaces')
    });
    const telemetryStore = new TelemetryStore({
      bufferPath: path.join(tempDir, 'telemetry', 'events.jsonl')
    });
    const service = new PrivacyService(env, {
      telemetryStore,
      now: () => 100
    });

    expect(service.getSnapshot('workspace-1').effective.preferences).toEqual({
      usageTelemetry: true,
      crashReports: false
    });

    service.updateConsent({
      scope: 'user',
      preferences: {
        usageTelemetry: false,
        crashReports: true
      }
    });
    service.updateConsent({
      scope: 'workspace',
      workspaceId: 'workspace-1',
      preferences: {
        usageTelemetry: true,
        crashReports: false
      }
    });

    const snapshot = service.getSnapshot('workspace-1');
    expect(snapshot.user.updatedAt).toBe(100);
    expect(snapshot.workspace?.updatedAt).toBe(100);
    expect(snapshot.effective.preferences).toEqual({
      usageTelemetry: true,
      crashReports: false
    });
  });

  it('exports and deletes collected telemetry data', () => {
    const env = createMockEnv({
      nexusDataDir: tempDir,
      workspaceDataDir: path.join(tempDir, 'workspaces')
    });
    const telemetryStore = new TelemetryStore({
      bufferPath: path.join(tempDir, 'telemetry', 'events.jsonl'),
      now: () => 200
    });
    telemetryStore.track({
      name: 'desktop.ready',
      scope: 'main',
      workspaceId: 'workspace-1'
    });
    telemetryStore.track({
      name: 'renderer.ready',
      scope: 'renderer'
    });

    const service = new PrivacyService(env, {
      telemetryStore,
      now: () => 300
    });

    const exported = service.exportData({
      workspaceId: 'workspace-1',
      mode: 'workspace'
    });
    const exportBody = JSON.parse(fs.readFileSync(exported.path, 'utf8')) as {
      records: Array<{ name: string }>;
    };

    expect(exported.recordCount).toBe(1);
    expect(exportBody.records).toEqual([
      expect.objectContaining({
        name: 'desktop.ready',
        workspaceId: 'workspace-1'
      })
    ]);

    expect(service.deleteData({ deleteExports: true })).toEqual({
      deleted: true,
      clearedRecords: 2,
      bufferPath: path.join(tempDir, 'telemetry', 'events.jsonl')
    });
    expect(service.getSnapshot('workspace-1').telemetry.eventCount).toBe(0);
    expect(fs.readdirSync(path.join(tempDir, 'privacy', 'exports'))).toEqual([]);
  });
});
