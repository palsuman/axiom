import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TelemetryService } from './telemetry-service';
import { createMockEnv } from '../test-utils/mock-env';

describe('TelemetryService', () => {
  it('stores renderer logs and exposes replay and health summaries', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-telemetry-service-'));
    const env = createMockEnv({ nexusDataDir: tempDir });
    const service = new TelemetryService(env, {
      featureFlags: {
        list: () => ({
          flags: [],
          activeKeys: ['observability.remoteCrashReporting'],
          summary: 'observability.remoteCrashReporting=on',
          sources: ['env'],
          unknownFlags: [],
          loadErrors: []
        }),
        getTelemetrySummary: () => 'observability.remoteCrashReporting=on'
      }
    });

    const record = service.trackRendererLog(
      {
        level: 'warn',
        message: 'renderer boot'
      },
      {
        sessionId: 'session-1',
        workspaceId: 'workspace-1'
      }
    );

    expect(record.name).toBe('renderer.log');
    expect(record.level).toBe('warn');

    const replay = service.replay({ limit: 10 });
    expect(replay.records).toHaveLength(1);
    expect(replay.records[0].workspaceId).toBe('workspace-1');
    expect(replay.records[0].attributes.featureFlags).toBe('observability.remoteCrashReporting=on');
    expect(replay.records[0].tags).toContain('ff:observability.remoteCrashReporting');

    const health = service.getHealth();
    expect(health.eventCount).toBe(1);
    expect(health.scopes.renderer).toBe(1);
  });

  it('returns best-effort records without persisting when telemetry consent is disabled', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-telemetry-service-disabled-'));
    const env = createMockEnv({ nexusDataDir: tempDir });
    const service = new TelemetryService(env, {
      privacy: {
        isTelemetryEnabled: () => false
      }
    });

    const record = service.track({
      name: 'desktop.blocked',
      scope: 'main',
      workspaceId: 'workspace-1'
    });

    expect(record.name).toBe('desktop.blocked');
    expect(service.replay({ limit: 10 }).records).toHaveLength(0);
    expect(service.getHealth().eventCount).toBe(0);
  });
});
