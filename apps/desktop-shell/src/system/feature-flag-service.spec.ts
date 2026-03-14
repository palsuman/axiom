import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FeatureFlagService } from './feature-flag-service';
import { createMockEnv } from '../test-utils/mock-env';

describe('FeatureFlagService', () => {
  it('loads local manifests plus env and cli overrides', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-flags-'));
    const flagFile = path.join(tempDir, 'feature-flags.json');
    fs.writeFileSync(
      flagFile,
      JSON.stringify({
        version: 1,
        flags: {
          'observability.healthDiagnostics': {
            enabled: true
          }
        }
      }),
      'utf8'
    );
    const env = createMockEnv({
      featureFlagsFile: flagFile,
      featureFlags: 'observability.remoteCrashReporting=false'
    });
    const service = new FeatureFlagService(env, {
      argv: ['nexus', '--feature-flag=observability.healthDiagnostics=false']
    });

    const snapshot = service.initialize();

    expect(snapshot.sources).toEqual(['local-file', 'env', 'cli']);
    expect(service.isEnabled('observability.remoteCrashReporting')).toBe(false);
    expect(service.isEnabled('observability.healthDiagnostics')).toBe(false);
  });

  it('refreshes remote manifests when configured', async () => {
    const env = createMockEnv({
      featureFlagsUrl: 'https://ops.example.com/flags.json'
    });
    const service = new FeatureFlagService(env, {
      fetch: jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            version: 1,
            flags: {
              'observability.healthDiagnostics': {
                enabled: true
              }
            }
          })
      })
    });

    await service.refreshRemote();

    expect(service.isEnabled('observability.healthDiagnostics')).toBe(true);
    expect(service.list().sources).toContain('remote-url');
  });

  it('records remote manifest errors without throwing', async () => {
    const env = createMockEnv({
      featureFlagsUrl: 'https://ops.example.com/flags.json'
    });
    const service = new FeatureFlagService(env, {
      fetch: jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => ''
      })
    });

    const snapshot = await service.refreshRemote();

    expect(snapshot.loadErrors).toContain('Feature flag manifest fetch failed with HTTP 503');
  });
});
