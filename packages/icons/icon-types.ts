export type IconKind =
  | 'codicon'
  | 'file-icon'
  | 'folder-icon'
  | 'theme-icon'
  | 'custom-class'
  | 'svg-ref';

export type IconThemeKind = 'light' | 'dark' | 'highContrast';

export type IconSourceType = 'font' | 'svg' | 'custom-class' | 'theme-token';

export interface IconVariantDescriptor {
  readonly cssClasses: readonly string[];
  readonly foreground?: string;
  readonly source?: IconSourceType;
  readonly viewBox?: string;
  readonly content?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface IconDefinition {
  readonly id: string;
  readonly version: number;
  readonly label: string;
  readonly kind: IconKind;
  readonly tags?: readonly string[];
  readonly aliases?: readonly string[];
  readonly fallbackId?: string;
  readonly defaultVariant?: IconThemeKind;
  readonly variants: Partial<Record<IconThemeKind, IconVariantDescriptor>>;
  readonly metadata?: Record<string, unknown>;
}

export interface IconResolveResult {
  readonly id: string;
  readonly definition: IconDefinition;
  readonly variant: IconVariantDescriptor;
  readonly theme: IconThemeKind;
  readonly isFallback: boolean;
}

export interface IconRegistryTelemetry {
  onRegister?(definition: IconDefinition): void;
  onDuplicate?(existing: IconDefinition, attempted: IconDefinition): void;
  onResolve?(result: IconResolveResult): void;
  onResolveMiss?(id: string): void;
}

export interface IconRegistryOptions {
  readonly fallback?: IconDefinition;
  readonly fallbackId?: string;
  readonly telemetry?: IconRegistryTelemetry;
  readonly defaultTheme?: IconThemeKind;
}

export interface IconRegistrationOptions {
  readonly allowOverride?: boolean;
  readonly skipTelemetry?: boolean;
}

export interface IconAliasOptions {
  readonly description?: string;
}

export const DEFAULT_FALLBACK_ICON: IconDefinition = {
  id: 'icon.fallback',
  version: 1,
  label: 'Generic fallback icon',
  kind: 'codicon',
  variants: {
    light: { cssClasses: ['codicon', 'codicon-question'], source: 'font' },
    dark: { cssClasses: ['codicon', 'codicon-question'], source: 'font' },
    highContrast: { cssClasses: ['codicon', 'codicon-question'], source: 'font' }
  }
};
