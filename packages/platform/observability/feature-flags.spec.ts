import {
  FeatureFlagRegistry,
  parseFeatureFlagAssignments,
  readFeatureFlagManifest,
  type FeatureFlagDefinition
} from './feature-flags';

const definitions: FeatureFlagDefinition[] = [
  {
    key: 'observability.remoteCrashReporting',
    description: 'Remote crash reporting',
    enabledByDefault: true,
    stage: 'stable'
  },
  {
    key: 'observability.healthDiagnostics',
    description: 'Health diagnostics',
    enabledByDefault: false,
    stage: 'preview'
  }
];

describe('feature-flags', () => {
  it('parses assignment strings', () => {
    expect(
      parseFeatureFlagAssignments(
        'observability.remoteCrashReporting=false,observability.healthDiagnostics=rollout:25'
      )
    ).toEqual({
      'observability.remoteCrashReporting': { enabled: false },
      'observability.healthDiagnostics': { rolloutPercentage: 25 }
    });
  });

  it('applies source precedence and kill switches', () => {
    const registry = new FeatureFlagRegistry(definitions, 'seed');
    const snapshot = registry.evaluate([
      {
        name: 'local-file',
        flags: {
          'observability.healthDiagnostics': { enabled: true }
        }
      },
      {
        name: 'env',
        flags: {
          'observability.healthDiagnostics': { enabled: false }
        }
      },
      {
        name: 'cli',
        flags: {
          'observability.healthDiagnostics': { killSwitch: true }
        }
      }
    ]);

    expect(snapshot.flags.find(flag => flag.key === 'observability.healthDiagnostics')).toMatchObject({
      enabled: false,
      reason: 'kill-switch',
      killSwitch: true
    });
  });

  it('evaluates staged rollouts deterministically', () => {
    const registry = new FeatureFlagRegistry(definitions, 'stable-seed');
    const first = registry.evaluate([
      {
        name: 'local-file',
        flags: {
          'observability.healthDiagnostics': { rolloutPercentage: 50 }
        }
      }
    ]);
    const second = registry.evaluate([
      {
        name: 'local-file',
        flags: {
          'observability.healthDiagnostics': { rolloutPercentage: 50 }
        }
      }
    ]);

    expect(first.flags.find(flag => flag.key === 'observability.healthDiagnostics')).toEqual(
      second.flags.find(flag => flag.key === 'observability.healthDiagnostics')
    );
  });

  it('surfaces unknown flags separately from evaluations', () => {
    const registry = new FeatureFlagRegistry(definitions, 'seed');
    const snapshot = registry.evaluate([
      {
        name: 'remote-url',
        flags: {
          'unknown.flag': { enabled: true }
        }
      }
    ]);

    expect(snapshot.unknownFlags).toEqual(['unknown.flag']);
  });

  it('reads feature flag manifests', () => {
    expect(
      readFeatureFlagManifest(
        JSON.stringify({
          version: 1,
          flags: {
            'observability.remoteCrashReporting': {
              enabled: false
            }
          }
        })
      )
    ).toEqual({
      version: 1,
      flags: {
        'observability.remoteCrashReporting': {
          enabled: false,
          rolloutPercentage: undefined,
          killSwitch: undefined
        }
      }
    });
  });
});
