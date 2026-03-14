import { createHash } from 'node:crypto';

export type FeatureFlagStage = 'stable' | 'preview' | 'internal';

export type FeatureFlagDefinition = {
  key: string;
  description: string;
  enabledByDefault: boolean;
  stage: FeatureFlagStage;
};

export type FeatureFlagRule = {
  enabled?: boolean;
  rolloutPercentage?: number;
  killSwitch?: boolean;
};

export type FeatureFlagSource = {
  name: string;
  flags: Record<string, FeatureFlagRule>;
};

export type FeatureFlagManifest = {
  version: 1;
  flags: Record<string, FeatureFlagRule>;
};

export type FeatureFlagReason = 'default' | 'override' | 'rollout' | 'kill-switch';

export type FeatureFlagEvaluation = {
  key: string;
  description: string;
  stage: FeatureFlagStage;
  enabledByDefault: boolean;
  enabled: boolean;
  reason: FeatureFlagReason;
  bucket: number;
  rolloutPercentage?: number;
  killSwitch: boolean;
  sources: string[];
};

export type FeatureFlagSnapshot = {
  flags: FeatureFlagEvaluation[];
  activeKeys: string[];
  summary: string;
  sources: string[];
  unknownFlags: string[];
  loadErrors: string[];
  configPath?: string;
  remoteUrl?: string;
  remoteLoadedAt?: number;
};

export class FeatureFlagRegistry {
  private readonly definitions = new Map<string, FeatureFlagDefinition>();

  constructor(
    definitions: readonly FeatureFlagDefinition[],
    private readonly seed: string
  ) {
    definitions.forEach(definition => {
      this.definitions.set(definition.key, definition);
    });
  }

  evaluate(
    sources: readonly FeatureFlagSource[],
    metadata: Pick<FeatureFlagSnapshot, 'configPath' | 'remoteUrl' | 'remoteLoadedAt' | 'loadErrors'> = { loadErrors: [] }
  ): FeatureFlagSnapshot {
    const sortedDefinitions = Array.from(this.definitions.values()).sort((left, right) => left.key.localeCompare(right.key));
    const sourceNames = sources.map(source => source.name);
    const unknownFlags = Array.from(
      new Set(
        sources.flatMap(source => Object.keys(source.flags).filter(key => !this.definitions.has(key)))
      )
    ).sort();

    const flags = sortedDefinitions.map(definition => this.evaluateDefinition(definition, sources));
    const activeKeys = flags.filter(flag => flag.enabled).map(flag => flag.key);
    return {
      flags,
      activeKeys,
      summary: flags.map(flag => `${flag.key}=${flag.enabled ? 'on' : 'off'}`).join(','),
      sources: sourceNames,
      unknownFlags,
      loadErrors: [...metadata.loadErrors],
      configPath: metadata.configPath,
      remoteUrl: metadata.remoteUrl,
      remoteLoadedAt: metadata.remoteLoadedAt
    };
  }

  private evaluateDefinition(definition: FeatureFlagDefinition, sources: readonly FeatureFlagSource[]): FeatureFlagEvaluation {
    let explicitEnabled: boolean | undefined;
    let rolloutPercentage: number | undefined;
    let killSwitch = false;
    const appliedSources: string[] = [];

    sources.forEach(source => {
      const rule = source.flags[definition.key];
      if (!rule) {
        return;
      }
      appliedSources.push(source.name);
      if (rule.enabled !== undefined) {
        explicitEnabled = rule.enabled;
      }
      if (rule.rolloutPercentage !== undefined) {
        rolloutPercentage = clampRollout(rule.rolloutPercentage);
      }
      if (rule.killSwitch) {
        killSwitch = true;
      }
    });

    const bucket = createBucket(this.seed, definition.key);
    if (killSwitch) {
      return {
        key: definition.key,
        description: definition.description,
        stage: definition.stage,
        enabledByDefault: definition.enabledByDefault,
        enabled: false,
        reason: 'kill-switch',
        bucket,
        rolloutPercentage,
        killSwitch: true,
        sources: appliedSources
      };
    }

    if (explicitEnabled === false) {
      return {
        key: definition.key,
        description: definition.description,
        stage: definition.stage,
        enabledByDefault: definition.enabledByDefault,
        enabled: false,
        reason: 'override',
        bucket,
        rolloutPercentage,
        killSwitch: false,
        sources: appliedSources
      };
    }

    if (rolloutPercentage !== undefined) {
      return {
        key: definition.key,
        description: definition.description,
        stage: definition.stage,
        enabledByDefault: definition.enabledByDefault,
        enabled: bucket < rolloutPercentage,
        reason: 'rollout',
        bucket,
        rolloutPercentage,
        killSwitch: false,
        sources: appliedSources
      };
    }

    if (explicitEnabled !== undefined) {
      return {
        key: definition.key,
        description: definition.description,
        stage: definition.stage,
        enabledByDefault: definition.enabledByDefault,
        enabled: explicitEnabled,
        reason: 'override',
        bucket,
        rolloutPercentage,
        killSwitch: false,
        sources: appliedSources
      };
    }

    return {
      key: definition.key,
      description: definition.description,
      stage: definition.stage,
      enabledByDefault: definition.enabledByDefault,
      enabled: definition.enabledByDefault,
      reason: 'default',
      bucket,
      rolloutPercentage,
      killSwitch: false,
      sources: appliedSources
    };
  }
}

export function parseFeatureFlagAssignments(raw: string | undefined): Record<string, FeatureFlagRule> {
  if (!raw?.trim()) {
    return {};
  }

  return raw
    .split(/[\n,;]+/)
    .map(token => token.trim())
    .filter(Boolean)
    .reduce<Record<string, FeatureFlagRule>>((accumulator, token) => {
      const separator = token.indexOf('=');
      const key = separator === -1 ? token : token.slice(0, separator).trim();
      const value = separator === -1 ? 'true' : token.slice(separator + 1).trim();
      if (!key) {
        return accumulator;
      }
      accumulator[key] = parseFeatureFlagRuleValue(value);
      return accumulator;
    }, {});
}

export function readFeatureFlagManifest(payload: string): FeatureFlagManifest {
  const parsed = JSON.parse(payload) as Partial<FeatureFlagManifest>;
  if (parsed.version !== 1 || typeof parsed.flags !== 'object' || !parsed.flags) {
    throw new Error('Invalid feature flag manifest');
  }

  const flags = Object.entries(parsed.flags).reduce<Record<string, FeatureFlagRule>>((accumulator, [key, value]) => {
    accumulator[key] = normalizeFeatureFlagRule(value);
    return accumulator;
  }, {});

  return {
    version: 1,
    flags
  };
}

function normalizeFeatureFlagRule(value: unknown): FeatureFlagRule {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid feature flag rule');
  }
  const rule = value as FeatureFlagRule;
  return {
    enabled: typeof rule.enabled === 'boolean' ? rule.enabled : undefined,
    rolloutPercentage:
      typeof rule.rolloutPercentage === 'number' ? clampRollout(rule.rolloutPercentage) : undefined,
    killSwitch: typeof rule.killSwitch === 'boolean' ? rule.killSwitch : undefined
  };
}

function parseFeatureFlagRuleValue(value: string): FeatureFlagRule {
  const normalized = value.toLowerCase();
  if (['1', 'true', 'on', 'enabled'].includes(normalized)) {
    return { enabled: true };
  }
  if (['0', 'false', 'off', 'disabled'].includes(normalized)) {
    return { enabled: false };
  }
  if (normalized === 'kill' || normalized === 'kill-switch') {
    return { killSwitch: true };
  }
  const rolloutMatch = normalized.match(/^rollout:(\d{1,3})$/);
  if (rolloutMatch) {
    return { rolloutPercentage: clampRollout(Number.parseInt(rolloutMatch[1], 10)) };
  }
  throw new Error(`Invalid feature flag assignment value: ${value}`);
}

function clampRollout(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`Invalid rollout percentage: ${value}`);
  }
  return Math.floor(value);
}

function createBucket(seed: string, key: string) {
  const digest = createHash('sha256').update(`${seed}:${key}`).digest('hex');
  return Number.parseInt(digest.slice(0, 8), 16) % 100;
}
