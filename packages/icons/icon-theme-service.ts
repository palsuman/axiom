import type { ThemeKind, ThemeIconTokens } from '@nexus/platform/theming/theme-registry';
import type { ThemeRuntime, ThemeRuntimeSnapshot } from '@nexus/platform/theming/theme-runtime';
import { BUILTIN_FILE_ICON_THEME } from './file-icon-mappings';
import { FileIconResolver } from './file-icon-resolver';
import type { FileIconRequest, FileIconResolution, FileIconTheme } from './file-icon-types';
import { registerBuiltinIconPack } from './builtin-icon-pack';
import { IconRegistry } from './icon-registry';
import type {
  IconAliasOptions,
  IconDefinition,
  IconRegistrationOptions,
  IconRegistryOptions,
  IconResolveResult,
  IconThemeKind
} from './icon-types';

export interface IconThemeCacheStats {
  readonly iconHits: number;
  readonly iconMisses: number;
  readonly fileHits: number;
  readonly fileMisses: number;
  readonly invalidations: number;
}

export interface IconThemeServiceSnapshot {
  readonly activeThemeId: string;
  readonly iconTheme: IconThemeKind;
  readonly themeRevision: number;
  readonly iconTokens: ThemeIconTokens;
  readonly cacheStats: IconThemeCacheStats;
  readonly registeredIconIds: readonly string[];
}

export interface IconThemeServiceTelemetry {
  onCacheHit?(event: {
    readonly kind: 'icon' | 'file';
    readonly cacheKey: string;
    readonly activeThemeId: string;
    readonly themeRevision: number;
  }): void;
  onCacheMiss?(event: {
    readonly kind: 'icon' | 'file';
    readonly cacheKey: string;
    readonly activeThemeId: string;
    readonly themeRevision: number;
  }): void;
  onCacheInvalidated?(event: {
    readonly reason: 'theme-change' | 'icon-registration' | 'alias-registration' | 'file-theme-change' | 'manual';
    readonly activeThemeId: string;
    readonly themeRevision: number;
  }): void;
  onThemeChange?(snapshot: IconThemeServiceSnapshot): void;
}

export interface IconThemeServiceOptions {
  readonly registry?: IconRegistry;
  readonly registryOptions?: IconRegistryOptions;
  readonly fileIconTheme?: FileIconTheme;
  readonly themeRuntime?: Pick<ThemeRuntime, 'getSnapshot' | 'onDidChange'>;
  readonly telemetry?: IconThemeServiceTelemetry;
}

export type IconThemeServiceListener = (snapshot: IconThemeServiceSnapshot) => void;

const DEFAULT_ICON_TOKENS = Object.freeze({
  'icon.size.xs': '12px',
  'icon.size.sm': '14px',
  'icon.size.md': '16px',
  'icon.size.lg': '20px',
  'icon.size.xl': '24px'
} satisfies ThemeIconTokens);

export function toIconThemeKind(themeKind: ThemeKind): IconThemeKind {
  switch (themeKind) {
    case 'light':
      return 'light';
    case 'dark':
      return 'dark';
    case 'high-contrast':
      return 'highContrast';
    default:
      return exhaustiveGuard(themeKind);
  }
}

export class IconThemeService {
  private readonly registry: IconRegistry;
  private readonly listeners = new Set<IconThemeServiceListener>();
  private readonly telemetry?: IconThemeServiceTelemetry;
  private readonly iconCache = new Map<string, IconResolveResult>();
  private readonly fileCache = new Map<string, FileIconResolution>();
  private fileIconTheme: FileIconTheme;
  private fileIconResolver: FileIconResolver;
  private activeThemeId = 'Nexus Light';
  private iconTheme: IconThemeKind = 'light';
  private themeRevision = 0;
  private iconTokens: ThemeIconTokens = { ...DEFAULT_ICON_TOKENS };
  private cacheStats: IconThemeCacheStats = {
    iconHits: 0,
    iconMisses: 0,
    fileHits: 0,
    fileMisses: 0,
    invalidations: 0
  };
  private disposeThemeRuntime?: () => void;

  constructor(options: IconThemeServiceOptions = {}) {
    this.registry = options.registry ?? new IconRegistry(options.registryOptions);
    registerBuiltinIconPack(this.registry, { allowOverride: true });
    this.fileIconTheme = options.fileIconTheme ?? BUILTIN_FILE_ICON_THEME;
    this.fileIconResolver = new FileIconResolver({ theme: this.fileIconTheme });
    this.telemetry = options.telemetry;

    if (options.themeRuntime) {
      this.bindThemeRuntime(options.themeRuntime);
    }
  }

  bindThemeRuntime(themeRuntime: Pick<ThemeRuntime, 'getSnapshot' | 'onDidChange'>) {
    this.disposeThemeRuntime?.();
    this.applyThemeSnapshot(themeRuntime.getSnapshot());
    this.disposeThemeRuntime = themeRuntime.onDidChange(event => {
      this.applyThemeSnapshot(event.snapshot);
    });
    return () => {
      this.disposeThemeRuntime?.();
      this.disposeThemeRuntime = undefined;
    };
  }

  getSnapshot(): IconThemeServiceSnapshot {
    return Object.freeze({
      activeThemeId: this.activeThemeId,
      iconTheme: this.iconTheme,
      themeRevision: this.themeRevision,
      iconTokens: { ...this.iconTokens },
      cacheStats: { ...this.cacheStats },
      registeredIconIds: this.registry.listIconIds()
    });
  }

  onDidChange(listener: IconThemeServiceListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  registerIcon(definition: IconDefinition, options: IconRegistrationOptions = {}) {
    const registered = this.registry.registerIcon(definition, options);
    this.invalidateCaches('icon-registration');
    return registered;
  }

  registerIcons(definitions: readonly IconDefinition[], options: IconRegistrationOptions = {}) {
    this.registry.registerIcons(definitions, options);
    this.invalidateCaches('icon-registration');
  }

  registerAlias(aliasId: string, targetId: string, options: IconAliasOptions = {}) {
    this.registry.registerAlias(aliasId, targetId, options);
    this.invalidateCaches('alias-registration');
  }

  setFileIconTheme(theme: FileIconTheme) {
    this.fileIconTheme = theme;
    this.fileIconResolver = new FileIconResolver({ theme: this.fileIconTheme });
    this.invalidateCaches('file-theme-change', { icon: false, file: true });
  }

  resolveIcon(id: string): IconResolveResult {
    const cacheKey = `${this.themeRevision}::${this.iconTheme}::${id}`;
    const cached = this.iconCache.get(cacheKey);
    if (cached) {
      this.cacheStats = { ...this.cacheStats, iconHits: this.cacheStats.iconHits + 1 };
      this.telemetry?.onCacheHit?.({
        kind: 'icon',
        cacheKey,
        activeThemeId: this.activeThemeId,
        themeRevision: this.themeRevision
      });
      return cached;
    }

    this.cacheStats = { ...this.cacheStats, iconMisses: this.cacheStats.iconMisses + 1 };
    this.telemetry?.onCacheMiss?.({
      kind: 'icon',
      cacheKey,
      activeThemeId: this.activeThemeId,
      themeRevision: this.themeRevision
    });

    const result = this.registry.resolveIcon(id, this.iconTheme);
    this.iconCache.set(cacheKey, result);
    return result;
  }

  resolveFileIcon(request: FileIconRequest): FileIconResolution {
    const cacheKey = `${this.themeRevision}::${serializeFileIconRequest(request)}`;
    const cached = this.fileCache.get(cacheKey);
    if (cached) {
      this.cacheStats = { ...this.cacheStats, fileHits: this.cacheStats.fileHits + 1 };
      this.telemetry?.onCacheHit?.({
        kind: 'file',
        cacheKey,
        activeThemeId: this.activeThemeId,
        themeRevision: this.themeRevision
      });
      return cached;
    }

    this.cacheStats = { ...this.cacheStats, fileMisses: this.cacheStats.fileMisses + 1 };
    this.telemetry?.onCacheMiss?.({
      kind: 'file',
      cacheKey,
      activeThemeId: this.activeThemeId,
      themeRevision: this.themeRevision
    });

    const result = this.fileIconResolver.resolve(request);
    this.fileCache.set(cacheKey, result);
    return result;
  }

  clearCaches() {
    this.invalidateCaches('manual');
  }

  dispose() {
    this.disposeThemeRuntime?.();
    this.disposeThemeRuntime = undefined;
    this.listeners.clear();
    this.iconCache.clear();
    this.fileCache.clear();
  }

  private applyThemeSnapshot(snapshot: ThemeRuntimeSnapshot) {
    const nextThemeId = snapshot.activeThemeId;
    const nextTheme = toIconThemeKind(snapshot.theme.kind);
    const sameTheme =
      nextThemeId === this.activeThemeId &&
      nextTheme === this.iconTheme &&
      snapshot.revision === this.themeRevision;

    this.activeThemeId = nextThemeId;
    this.iconTheme = nextTheme;
    this.themeRevision = snapshot.revision;
    this.iconTokens = { ...snapshot.icons };

    if (!sameTheme) {
      this.invalidateCaches('theme-change');
    } else {
      this.emitDidChange();
    }
  }

  private invalidateCaches(
    reason: 'theme-change' | 'icon-registration' | 'alias-registration' | 'file-theme-change' | 'manual',
    targets: { icon?: boolean; file?: boolean } = { icon: true, file: true }
  ) {
    if (targets.icon ?? true) {
      this.iconCache.clear();
    }
    if (targets.file ?? true) {
      this.fileCache.clear();
    }
    this.cacheStats = { ...this.cacheStats, invalidations: this.cacheStats.invalidations + 1 };
    this.telemetry?.onCacheInvalidated?.({
      reason,
      activeThemeId: this.activeThemeId,
      themeRevision: this.themeRevision
    });
    this.emitDidChange();
  }

  private emitDidChange() {
    const snapshot = this.getSnapshot();
    this.telemetry?.onThemeChange?.(snapshot);
    this.listeners.forEach(listener => listener(snapshot));
  }
}

export function createDefaultIconThemeService(options: Omit<IconThemeServiceOptions, 'fileIconTheme'> = {}) {
  return new IconThemeService({
    fileIconTheme: BUILTIN_FILE_ICON_THEME,
    ...options
  });
}

function serializeFileIconRequest(request: FileIconRequest) {
  return [
    request.fileName,
    request.languageId ?? '',
    request.isFolder ? '1' : '0',
    request.isFolderExpanded ? '1' : '0',
    request.isRootFolder ? '1' : '0'
  ].join('|');
}

function exhaustiveGuard(value: never): never {
  throw new Error(`Unsupported theme kind: ${String(value)}`);
}
