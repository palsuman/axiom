import {
  DEFAULT_FALLBACK_ICON,
  IconAliasOptions,
  IconDefinition,
  IconRegistrationOptions,
  IconRegistryOptions,
  IconRegistryTelemetry,
  IconResolveResult,
  IconThemeKind,
  IconVariantDescriptor
} from './icon-types';

const CACHE_KEY_SEPARATOR = '::';
const MAX_ALIAS_DEPTH = 10;

interface AliasEntry {
  readonly targetId: string;
  readonly description?: string;
}

export class IconRegistry {
  private readonly definitions = new Map<string, IconDefinition>();
  private readonly aliases = new Map<string, AliasEntry>();
  private readonly cache = new Map<string, IconResolveResult>();
  private readonly telemetry?: IconRegistryTelemetry;
  private readonly defaultTheme: IconThemeKind;
  private readonly fallbackIconId: string;

  constructor(options: IconRegistryOptions = {}) {
    this.telemetry = options.telemetry;
    this.defaultTheme = options.defaultTheme ?? 'light';
    const fallbackDefinition = options.fallback ?? DEFAULT_FALLBACK_ICON;
    this.fallbackIconId = options.fallbackId ?? fallbackDefinition.id;
    this.registerIcon(fallbackDefinition, { allowOverride: true, skipTelemetry: true });
  }

  registerIcon(definition: IconDefinition, options: IconRegistrationOptions = {}): IconDefinition {
    this.validateDefinition(definition);
    const normalized = this.normalizeDefinition(definition);
    const alreadyRegistered = this.definitions.get(normalized.id);

    if (alreadyRegistered && !options.allowOverride) {
      this.telemetry?.onDuplicate?.(alreadyRegistered, normalized);
      throw new Error(`Icon with id "${normalized.id}" already registered`);
    }

    this.definitions.set(normalized.id, normalized);
    this.clearCacheFor(normalized.id);
    this.clearCacheForAliases(normalized.id);

    if (!options.skipTelemetry) {
      this.telemetry?.onRegister?.(normalized);
    }

    if (normalized.aliases) {
      normalized.aliases.forEach(alias => this.registerAlias(alias, normalized.id));
    }

    return normalized;
  }

  registerIcons(definitions: readonly IconDefinition[], options: IconRegistrationOptions = {}): void {
    definitions.forEach(def => this.registerIcon(def, options));
  }

  registerAlias(aliasId: string, targetId: string, options: IconAliasOptions = {}): void {
    if (!aliasId || !targetId) {
      throw new Error('Alias id and target id are required');
    }

    if (aliasId === targetId) {
      throw new Error('Alias id cannot match target id');
    }

    this.aliases.set(aliasId, { targetId, description: options.description });
    this.clearCacheFor(aliasId);
  }

  hasIcon(id: string): boolean {
    return this.definitions.has(id) || this.aliases.has(id);
  }

  listIconIds(): string[] {
    return Array.from(new Set([...this.definitions.keys(), ...this.aliases.keys()])).sort();
  }

  getDefinition(id: string): IconDefinition | undefined {
    const canonical = this.resolveCanonicalId(id);
    return canonical ? this.definitions.get(canonical) : undefined;
  }

  resolveIcon(id: string, theme: IconThemeKind = this.defaultTheme): IconResolveResult {
    const cacheKey = this.cacheKey(id, theme);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const canonicalId = this.resolveCanonicalId(id);
    let definition = canonicalId ? this.definitions.get(canonicalId) : undefined;
    let resolvedId = canonicalId ?? id;
    let isFallback = false;

    if (!definition) {
      this.telemetry?.onResolveMiss?.(id);
      definition = this.definitions.get(this.fallbackIconId);
      resolvedId = this.fallbackIconId;
      isFallback = true;
    }

    if (!definition) {
      throw new Error('Fallback icon definition is missing.');
    }

    const picked = this.pickVariant(definition, theme);
    const result: IconResolveResult = Object.freeze({
      id: resolvedId,
      definition,
      variant: picked.variant,
      theme: picked.theme,
      isFallback
    });

    this.cache.set(cacheKey, result);
    this.telemetry?.onResolve?.(result);
    return result;
  }

  clear(): void {
    const fallback = this.definitions.get(this.fallbackIconId);
    this.definitions.clear();
    this.aliases.clear();
    this.cache.clear();
    if (fallback) {
      this.definitions.set(this.fallbackIconId, fallback);
    }
  }

  private pickVariant(definition: IconDefinition, theme: IconThemeKind): { theme: IconThemeKind; variant: IconVariantDescriptor } {
    const variants = definition.variants;
    if (variants[theme]) {
      return { theme, variant: variants[theme]! };
    }

    if (definition.defaultVariant && variants[definition.defaultVariant]) {
      return { theme: definition.defaultVariant, variant: variants[definition.defaultVariant]! };
    }

    const availableEntry = Object.entries(variants).find(([, value]) => Boolean(value));
    if (availableEntry) {
      return { theme: availableEntry[0] as IconThemeKind, variant: availableEntry[1]! };
    }

    throw new Error(`Icon definition "${definition.id}" does not contain any variants.`);
  }

  private resolveCanonicalId(id: string): string | undefined {
    if (this.definitions.has(id)) {
      return id;
    }

    let current = id;
    const visited = new Set<string>();

    for (let depth = 0; depth < MAX_ALIAS_DEPTH; depth += 1) {
      const alias = this.aliases.get(current);
      if (!alias) {
        return undefined;
      }

      if (visited.has(current)) {
        throw new Error(`Alias resolution loop detected for "${id}".`);
      }

      visited.add(current);
      current = alias.targetId;
      if (this.definitions.has(current)) {
        return current;
      }
    }

    return undefined;
  }

  private validateDefinition(definition: IconDefinition): void {
    if (!definition.id) {
      throw new Error('Icon id is required');
    }

    if (!definition.variants || Object.keys(definition.variants).length === 0) {
      throw new Error(`Icon "${definition.id}" must define at least one variant.`);
    }

    Object.values(definition.variants).forEach(variant => {
      if (!variant) {
        return;
      }
      if (!variant.cssClasses || variant.cssClasses.length === 0) {
        throw new Error(`Icon "${definition.id}" variant is missing cssClasses.`);
      }
    });
  }

  private normalizeDefinition(definition: IconDefinition): IconDefinition {
    const normalizedVariants: IconDefinition['variants'] = {};
    (Object.keys(definition.variants) as IconThemeKind[]).forEach(theme => {
      const variant = definition.variants[theme];
      if (!variant) {
        return;
      }
      normalizedVariants[theme] = {
        ...variant,
        cssClasses: [...variant.cssClasses]
      };
    });

    return {
      ...definition,
      variants: normalizedVariants,
      aliases: definition.aliases ? [...definition.aliases] : undefined,
      tags: definition.tags ? [...definition.tags] : undefined
    };
  }

  private cacheKey(id: string, theme: IconThemeKind): string {
    return `${id}${CACHE_KEY_SEPARATOR}${theme}`;
  }

  private clearCacheFor(id: string): void {
    Array.from(this.cache.keys()).forEach(key => {
      if (key.startsWith(`${id}${CACHE_KEY_SEPARATOR}`)) {
        this.cache.delete(key);
      }
    });
  }

  private clearCacheForAliases(targetId: string): void {
    this.aliases.forEach((entry, aliasId) => {
      if (entry.targetId === targetId) {
        this.clearCacheFor(aliasId);
      }
    });
  }
}
