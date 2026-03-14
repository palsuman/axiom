import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { NexusEnv } from '@nexus/platform/config/env';
import {
  FeatureFlagRegistry,
  parseFeatureFlagAssignments,
  readFeatureFlagManifest,
  type FeatureFlagDefinition,
  type FeatureFlagSnapshot,
  type FeatureFlagSource
} from '@nexus/platform/observability/feature-flags';

type FetchResponseLike = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

type FetchLike = (input: string) => Promise<FetchResponseLike>;

type FeatureFlagServiceOptions = {
  fs?: typeof fs;
  fetch?: FetchLike;
  argv?: string[];
};

const FEATURE_FLAG_DEFINITIONS: FeatureFlagDefinition[] = [
  {
    key: 'observability.remoteCrashReporting',
    description: 'Allow the enterprise crash-report upload sink when configured.',
    enabledByDefault: true,
    stage: 'stable'
  },
  {
    key: 'observability.performanceTracing',
    description: 'Enable performance tracing surfaces and related instrumentation.',
    enabledByDefault: false,
    stage: 'preview'
  },
  {
    key: 'observability.healthDiagnostics',
    description: 'Enable health diagnostics services and renderer surfaces.',
    enabledByDefault: false,
    stage: 'preview'
  }
];

export class FeatureFlagService {
  private readonly fsApi: typeof fs;
  private readonly fetchApi?: FetchLike;
  private readonly argv: string[];
  private readonly registry: FeatureFlagRegistry;
  private snapshot: FeatureFlagSnapshot;

  constructor(
    private readonly env: NexusEnv,
    options: FeatureFlagServiceOptions = {}
  ) {
    this.fsApi = options.fs ?? fs;
    this.fetchApi = options.fetch;
    this.argv = options.argv ?? process.argv;
    this.registry = new FeatureFlagRegistry(FEATURE_FLAG_DEFINITIONS, createInstallSeed(env));
    this.snapshot = this.registry.evaluate([], {
      configPath: env.featureFlagsFile,
      remoteUrl: env.featureFlagsUrl,
      loadErrors: []
    });
  }

  initialize() {
    this.snapshot = this.evaluateLocalSnapshot();
    return this.snapshot;
  }

  async refreshRemote() {
    this.snapshot = await this.evaluateWithRemoteSnapshot();
    return this.snapshot;
  }

  list() {
    return this.snapshot;
  }

  isEnabled(key: string) {
    const match = this.snapshot.flags.find(flag => flag.key === key);
    return match?.enabled ?? false;
  }

  getTelemetrySummary() {
    return this.snapshot.summary;
  }

  private evaluateLocalSnapshot() {
    const cli = parseCliArgs(this.argv);
    const sources: FeatureFlagSource[] = [];
    const loadErrors: string[] = [];

    const configPath = cli.configPath ?? this.env.featureFlagsFile;
    if (configPath && this.fsApi.existsSync(configPath)) {
      try {
        const manifest = readFeatureFlagManifest(this.fsApi.readFileSync(configPath, 'utf8'));
        sources.push({
          name: 'local-file',
          flags: manifest.flags
        });
      } catch (error) {
        loadErrors.push(error instanceof Error ? error.message : String(error));
      }
    }

    const remoteUrl = cli.remoteUrl ?? this.env.featureFlagsUrl;
    pushOverrideSources(sources, this.env.featureFlags, cli.overrides);
    return this.registry.evaluate(sources, {
      configPath,
      remoteUrl,
      loadErrors
    });
  }

  private async evaluateWithRemoteSnapshot() {
    const cli = parseCliArgs(this.argv);
    const sources: FeatureFlagSource[] = [];
    const loadErrors: string[] = [];

    const configPath = cli.configPath ?? this.env.featureFlagsFile;
    if (configPath && this.fsApi.existsSync(configPath)) {
      try {
        const manifest = readFeatureFlagManifest(this.fsApi.readFileSync(configPath, 'utf8'));
        sources.push({
          name: 'local-file',
          flags: manifest.flags
        });
      } catch (error) {
        loadErrors.push(error instanceof Error ? error.message : String(error));
      }
    }

    const remoteUrl = cli.remoteUrl ?? this.env.featureFlagsUrl;
    if (!remoteUrl) {
      pushOverrideSources(sources, this.env.featureFlags, cli.overrides);
      return this.registry.evaluate(sources, {
        configPath,
        remoteUrl,
        loadErrors
      });
    }

    return this.loadRemoteSource(remoteUrl)
      .then(remoteSource => {
        if (remoteSource) {
          sources.push(remoteSource);
        }
        pushOverrideSources(sources, this.env.featureFlags, cli.overrides);
        return this.registry.evaluate(sources, {
          configPath,
          remoteUrl,
          remoteLoadedAt: Date.now(),
          loadErrors
        });
      })
      .catch(error =>
        (() => {
          pushOverrideSources(sources, this.env.featureFlags, cli.overrides);
          return this.registry.evaluate(sources, {
            configPath,
            remoteUrl,
            loadErrors: [...loadErrors, error instanceof Error ? error.message : String(error)]
          });
        })()
      );
  }

  private async loadRemoteSource(remoteUrl: string): Promise<FeatureFlagSource | undefined> {
    const fetchApi =
      this.fetchApi ??
      (typeof globalThis.fetch === 'function' ? ((globalThis.fetch as unknown) as FetchLike) : undefined);
    if (!fetchApi) {
      throw new Error('Feature flag remote fetch implementation is unavailable');
    }

    const response = await fetchApi(remoteUrl);
    if (!response.ok) {
      throw new Error(`Feature flag manifest fetch failed with HTTP ${response.status}`);
    }
    const manifest = readFeatureFlagManifest(await response.text());
    return {
      name: 'remote-url',
      flags: manifest.flags
    };
  }
}

function pushOverrideSources(
  sources: FeatureFlagSource[],
  envAssignments: string | undefined,
  cliOverrides: Record<string, { enabled?: boolean; rolloutPercentage?: number; killSwitch?: boolean }>
) {
  const envOverrides = parseFeatureFlagAssignments(envAssignments);
  if (Object.keys(envOverrides).length) {
    sources.push({
      name: 'env',
      flags: envOverrides
    });
  }

  if (Object.keys(cliOverrides).length) {
    sources.push({
      name: 'cli',
      flags: cliOverrides
    });
  }
}

function createInstallSeed(env: NexusEnv) {
  return createHash('sha256').update(env.nexusHome).digest('hex');
}

function parseCliArgs(argv: string[]) {
  const overrides: Record<string, { enabled?: boolean; rolloutPercentage?: number; killSwitch?: boolean }> = {};
  let configPath: string | undefined;
  let remoteUrl: string | undefined;

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }

    if (arg.startsWith('--feature-flag=')) {
      Object.assign(overrides, parseFeatureFlagAssignments(arg.slice('--feature-flag='.length)));
      continue;
    }
    if (arg === '--feature-flag' && argv[index + 1]) {
      Object.assign(overrides, parseFeatureFlagAssignments(argv[index + 1]));
      index += 1;
      continue;
    }
    if (arg.startsWith('--disable-feature-flag=')) {
      const key = arg.slice('--disable-feature-flag='.length);
      overrides[key] = { enabled: false };
      continue;
    }
    if (arg === '--disable-feature-flag' && argv[index + 1]) {
      overrides[argv[index + 1]] = { enabled: false };
      index += 1;
      continue;
    }
    if (arg.startsWith('--feature-flags=')) {
      configPath = path.resolve(arg.slice('--feature-flags='.length));
      continue;
    }
    if (arg === '--feature-flags' && argv[index + 1]) {
      configPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--feature-flags-url=')) {
      remoteUrl = arg.slice('--feature-flags-url='.length);
      continue;
    }
    if (arg === '--feature-flags-url' && argv[index + 1]) {
      remoteUrl = argv[index + 1];
      index += 1;
    }
  }

  return {
    overrides,
    configPath,
    remoteUrl
  };
}
