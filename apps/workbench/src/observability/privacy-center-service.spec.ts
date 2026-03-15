import type { TelemetryConsentSnapshot } from '@nexus/contracts/ipc';
import { PrivacyCenterService } from './privacy-center-service';

describe('PrivacyCenterService', () => {
  function createConsentSnapshot(): TelemetryConsentSnapshot {
    return {
      workspaceId: 'workspace-1',
      categories: [
        {
          key: 'usageTelemetry',
          title: 'Usage & diagnostics telemetry',
          description: 'Collect local diagnostics and usage events.'
        },
        {
          key: 'crashReports',
          title: 'Crash report sharing',
          description: 'Allow crash report sending.'
        }
      ],
      user: {
        scope: 'user',
        source: 'persisted',
        updatedAt: 10,
        preferences: {
          usageTelemetry: true,
          crashReports: false
        }
      },
      workspace: {
        scope: 'workspace',
        workspaceId: 'workspace-1',
        source: 'persisted',
        updatedAt: 20,
        preferences: {
          usageTelemetry: false,
          crashReports: false
        }
      },
      effective: {
        scope: 'workspace',
        workspaceId: 'workspace-1',
        source: 'persisted',
        updatedAt: 20,
        preferences: {
          usageTelemetry: false,
          crashReports: false
        }
      },
      telemetry: {
        bufferPath: '/tmp/telemetry/events.jsonl',
        eventCount: 5,
        fileBytes: 100,
        dropped: 0,
        lastSequence: 5,
        oldestRecordedAt: 1,
        newestRecordedAt: 5,
        levels: { error: 0, warn: 1, info: 4, debug: 0 },
        scopes: { main: 2, renderer: 3, preload: 0, shared: 0 },
        collectionEnabled: false
      }
    };
  }

  function createBridge() {
    let snapshot = createConsentSnapshot();
    return {
      privacyGetConsent: jest.fn(async () => snapshot),
      privacyUpdateConsent: jest.fn(async payload => {
        snapshot = {
          ...snapshot,
          effective: {
            ...snapshot.effective,
            scope: payload.scope,
            workspaceId: payload.workspaceId,
            updatedAt: 30,
            preferences: { ...payload.preferences }
          }
        };
        return snapshot;
      }),
      privacyExportData: jest.fn(async () => ({
        path: '/tmp/privacy/export.json',
        recordCount: 5,
        exportedAt: 40,
        mode: 'all' as const,
        workspaceId: 'workspace-1'
      })),
      privacyDeleteData: jest.fn(async () => ({
        deleted: true,
        clearedRecords: 5,
        bufferPath: '/tmp/telemetry/events.jsonl'
      }))
    };
  }

  it('opens the privacy center and loads consent state', async () => {
    const shell = {
      openEditor: jest.fn()
    };
    const bridge = createBridge();
    const service = new PrivacyCenterService({
      shell: shell as never,
      bridge,
      workspaceId: 'workspace-1'
    });

    const snapshot = await service.open();

    expect(shell.openEditor).toHaveBeenCalledWith({
      title: 'Privacy Center',
      resource: 'privacy://center',
      kind: 'text'
    });
    expect(snapshot.consent?.effective.preferences.usageTelemetry).toBe(false);
  });

  it('updates consent, exports, and deletes telemetry data', async () => {
    const bridge = createBridge();
    const service = new PrivacyCenterService({
      bridge,
      workspaceId: 'workspace-1'
    });

    await service.refresh();
    await service.updateConsent('workspace', {
      usageTelemetry: true,
      crashReports: true
    });
    expect(service.getSnapshot().consent?.effective.preferences).toEqual({
      usageTelemetry: true,
      crashReports: true
    });

    await service.exportData('all');
    expect(service.getSnapshot().lastExport?.path).toBe('/tmp/privacy/export.json');

    await service.deleteData(true);
    expect(service.getSnapshot().lastDelete?.clearedRecords).toBe(5);
  });
});
