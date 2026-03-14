import {
  DEFAULT_THEME_COLORS_BY_KIND,
  THEME_COLOR_SLOTS,
  THEME_ICON_SLOTS,
  THEME_LAYOUT_SLOTS,
  THEME_SPACING_SLOTS,
  THEME_TYPOGRAPHY_SLOTS,
  createDefaultThemeTokens,
  isThemeColorSlot,
  isThemeIconSlot,
  isThemeLayoutSlot,
  isThemeSpacingSlot,
  isThemeTypographySlot,
  isValidThemeColorValue,
  isValidThemeIconValue,
  isValidThemeLayoutValue,
  isValidThemeSpacingValue,
  isValidThemeTypographyValue,
  toCssVariables,
  type ThemeBase,
  type ThemeColorSlot,
  type ThemeColorTokens,
  type ThemeIconSlot,
  type ThemeIconTokens,
  type ThemeKind,
  type ThemeLayoutSlot,
  type ThemeLayoutTokens,
  type ThemeSpacingSlot,
  type ThemeSpacingTokens,
  type ThemeTypographySlot,
  type ThemeTypographyTokens
} from './theme-token-catalog';

export {
  DEFAULT_THEME_COLORS_BY_KIND,
  DEFAULT_THEME_LAYOUT_TOKENS,
  THEME_COLOR_SLOTS,
  THEME_CSS_VARIABLES_BY_SLOT,
  THEME_ICON_SLOTS,
  THEME_LAYOUT_SLOTS,
  THEME_SPACING_SLOTS,
  THEME_TYPOGRAPHY_SLOTS,
  createDefaultThemeCssVariables,
  createDefaultThemeTokens,
  isThemeColorSlot,
  isThemeIconSlot,
  isThemeLayoutSlot,
  isThemeSpacingSlot,
  isThemeTypographySlot,
  isValidThemeColorValue,
  isValidThemeIconValue,
  isValidThemeLayoutValue,
  isValidThemeSpacingValue,
  isValidThemeTypographyValue,
  toCssVariables,
  type ThemeBase,
  type ThemeColorSlot,
  type ThemeColorTokens,
  type ThemeDesignTokens,
  type ThemeIconSlot,
  type ThemeIconTokens,
  type ThemeKind,
  type ThemeLayoutSlot,
  type ThemeLayoutTokens,
  type ThemeManifestTokens,
  type ThemeSpacingSlot,
  type ThemeSpacingTokens,
  type ThemeTypographySlot,
  type ThemeTypographyTokens
} from './theme-token-catalog';

export type ThemeManifest = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly kind: ThemeKind;
  readonly extends?: string;
  readonly uiBaseTheme?: ThemeBase;
  readonly colors?: Partial<Record<ThemeColorSlot, string>>;
  readonly typography?: Partial<Record<ThemeTypographySlot, string>>;
  readonly spacing?: Partial<Record<ThemeSpacingSlot, string>>;
  readonly icons?: Partial<Record<ThemeIconSlot, string>>;
  readonly layout?: Partial<Record<ThemeLayoutSlot, string>>;
};

export type ResolvedThemeDefinition = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly kind: ThemeKind;
  readonly extends?: string;
  readonly uiBaseTheme: ThemeBase;
  readonly colors: ThemeColorTokens;
  readonly typography: ThemeTypographyTokens;
  readonly spacing: ThemeSpacingTokens;
  readonly icons: ThemeIconTokens;
  readonly layout: ThemeLayoutTokens;
  readonly cssVariables: Record<string, string>;
  readonly inheritanceChain: readonly string[];
};

export type ThemeSchemaDocument = {
  readonly $schema: string;
  readonly title: string;
  readonly type: 'object';
  readonly additionalProperties: false;
  readonly required: readonly string[];
  readonly properties: Record<string, unknown>;
};

const THEME_BASE_BY_KIND: Record<ThemeKind, ThemeBase> = {
  light: 'vs',
  dark: 'vs-dark',
  'high-contrast': 'hc-black'
};

export const BUILTIN_THEME_MANIFESTS: readonly ThemeManifest[] = Object.freeze([
  {
    id: 'Nexus Dark',
    label: 'Nexus Dark',
    description: 'Default dark theme tuned for the Nexus workbench.',
    kind: 'dark',
    uiBaseTheme: 'vs-dark',
    colors: { ...DEFAULT_THEME_COLORS_BY_KIND.dark }
  },
  {
    id: 'Nexus Light',
    label: 'Nexus Light',
    description: 'Default light theme tuned for the Nexus workbench.',
    kind: 'light',
    uiBaseTheme: 'vs',
    colors: { ...DEFAULT_THEME_COLORS_BY_KIND.light }
  },
  {
    id: 'Nexus High Contrast',
    label: 'Nexus High Contrast',
    description: 'Accessibility-focused high-contrast theme for the Nexus workbench.',
    kind: 'high-contrast',
    uiBaseTheme: 'hc-black',
    colors: { ...DEFAULT_THEME_COLORS_BY_KIND['high-contrast'] }
  }
]);

export const THEME_MANIFEST_SCHEMA: ThemeSchemaDocument = Object.freeze({
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Nexus Theme Manifest',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'label', 'kind'],
  properties: {
    id: { type: 'string', minLength: 1 },
    label: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    kind: { type: 'string', enum: ['light', 'dark', 'high-contrast'] },
    extends: { type: 'string', minLength: 1 },
    uiBaseTheme: { type: 'string', enum: ['vs', 'vs-dark', 'hc-black'] },
    colors: createSectionSchema(THEME_COLOR_SLOTS),
    typography: createSectionSchema(THEME_TYPOGRAPHY_SLOTS),
    spacing: createSectionSchema(THEME_SPACING_SLOTS),
    icons: createSectionSchema(THEME_ICON_SLOTS),
    layout: createSectionSchema(THEME_LAYOUT_SLOTS)
  }
});

export class ThemeRegistry {
  private readonly manifests = new Map<string, ThemeManifest>();

  register(manifest: ThemeManifest) {
    const normalized = normalizeManifest(manifest);
    if (this.manifests.has(normalized.id)) {
      throw new Error(`Theme "${normalized.id}" is already registered`);
    }
    if (normalized.extends && !this.manifests.has(normalized.extends)) {
      throw new Error(`Theme "${normalized.id}" extends unknown theme "${normalized.extends}"`);
    }
    validateManifest(normalized);
    this.manifests.set(normalized.id, normalized);
    return normalized;
  }

  registerMany(manifests: readonly ThemeManifest[]) {
    manifests.forEach(manifest => {
      this.register(manifest);
    });
    return this.list();
  }

  has(id: string) {
    return this.manifests.has(id);
  }

  get(id: string) {
    return this.manifests.get(id);
  }

  list() {
    return Array.from(this.manifests.values());
  }

  toJSONSchema() {
    return THEME_MANIFEST_SCHEMA;
  }

  resolve(id: string): ResolvedThemeDefinition {
    return this.resolveTheme(id, new Set());
  }

  private resolveTheme(id: string, seen: Set<string>): ResolvedThemeDefinition {
    const manifest = this.manifests.get(id);
    if (!manifest) {
      throw new Error(`Theme "${id}" is not registered`);
    }
    if (seen.has(id)) {
      throw new Error(`Theme inheritance cycle detected at "${id}"`);
    }
    seen.add(id);

    const inherited = manifest.extends ? this.resolveTheme(manifest.extends, seen) : undefined;
    const defaults = createDefaultThemeTokens(manifest.kind);
    const colors = {
      ...(inherited?.colors ?? defaults.colors),
      ...(manifest.colors ?? {})
    };
    const typography = {
      ...(inherited?.typography ?? defaults.typography),
      ...(manifest.typography ?? {})
    };
    const spacing = {
      ...(inherited?.spacing ?? defaults.spacing),
      ...(manifest.spacing ?? {})
    };
    const icons = {
      ...(inherited?.icons ?? defaults.icons),
      ...(manifest.icons ?? {})
    };
    const layout = {
      ...(inherited?.layout ?? defaults.layout),
      ...(manifest.layout ?? {})
    };
    const inheritanceChain = inherited ? [...inherited.inheritanceChain, manifest.id] : [manifest.id];
    const uiBaseTheme = manifest.uiBaseTheme ?? inherited?.uiBaseTheme ?? THEME_BASE_BY_KIND[manifest.kind];

    seen.delete(id);

    return {
      id: manifest.id,
      label: manifest.label,
      description: manifest.description,
      kind: manifest.kind,
      extends: manifest.extends,
      uiBaseTheme,
      colors,
      typography,
      spacing,
      icons,
      layout,
      cssVariables: toCssVariables({
        colors,
        typography,
        spacing,
        icons,
        layout
      }),
      inheritanceChain
    };
  }
}

export function createDefaultThemeRegistry() {
  const registry = new ThemeRegistry();
  registry.registerMany(BUILTIN_THEME_MANIFESTS);
  return registry;
}

function createSectionSchema(slots: readonly string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    propertyNames: {
      enum: [...slots]
    },
    patternProperties: {
      '.*': { type: 'string', minLength: 1 }
    }
  };
}

function normalizeManifest(manifest: ThemeManifest): ThemeManifest {
  return {
    ...manifest,
    id: manifest.id.trim(),
    label: manifest.label.trim(),
    description: manifest.description?.trim(),
    extends: manifest.extends?.trim(),
    colors: normalizeSection(manifest.colors),
    typography: normalizeSection(manifest.typography),
    spacing: normalizeSection(manifest.spacing),
    icons: normalizeSection(manifest.icons),
    layout: normalizeSection(manifest.layout)
  };
}

function normalizeSection<TSlot extends string>(section: Partial<Record<TSlot, string>> | undefined) {
  if (!section) {
    return undefined;
  }
  return Object.entries(section).reduce<Partial<Record<TSlot, string>>>((normalized, [slot, value]) => {
    normalized[slot as TSlot] = String(value).trim();
    return normalized;
  }, {});
}

function validateManifest(manifest: ThemeManifest) {
  if (!manifest.id) {
    throw new Error('Theme id is required');
  }
  if (!manifest.label) {
    throw new Error(`Theme "${manifest.id}" must have a label`);
  }
  validateColorSection(manifest.id, manifest.colors);
  validateTypographySection(manifest.id, manifest.typography);
  validateSpacingSection(manifest.id, manifest.spacing);
  validateIconSection(manifest.id, manifest.icons);
  validateLayoutSection(manifest.id, manifest.layout);
}

function validateColorSection(themeId: string, section: ThemeManifest['colors']) {
  if (!section) {
    return;
  }
  Object.entries(section).forEach(([slot, value]) => {
    if (!isThemeColorSlot(slot)) {
      throw new Error(`Theme "${themeId}" defines unknown color slot "${slot}"`);
    }
    if (!isValidThemeColorValue(value)) {
      throw new Error(`Theme "${themeId}" defines invalid color value for "${slot}"`);
    }
  });
}

function validateTypographySection(themeId: string, section: ThemeManifest['typography']) {
  if (!section) {
    return;
  }
  Object.entries(section).forEach(([slot, value]) => {
    if (!isThemeTypographySlot(slot)) {
      throw new Error(`Theme "${themeId}" defines unknown typography slot "${slot}"`);
    }
    if (!isValidThemeTypographyValue(slot, value)) {
      throw new Error(`Theme "${themeId}" defines invalid typography value for "${slot}"`);
    }
  });
}

function validateSpacingSection(themeId: string, section: ThemeManifest['spacing']) {
  if (!section) {
    return;
  }
  Object.entries(section).forEach(([slot, value]) => {
    if (!isThemeSpacingSlot(slot)) {
      throw new Error(`Theme "${themeId}" defines unknown spacing slot "${slot}"`);
    }
    if (!isValidThemeSpacingValue(value)) {
      throw new Error(`Theme "${themeId}" defines invalid spacing value for "${slot}"`);
    }
  });
}

function validateIconSection(themeId: string, section: ThemeManifest['icons']) {
  if (!section) {
    return;
  }
  Object.entries(section).forEach(([slot, value]) => {
    if (!isThemeIconSlot(slot)) {
      throw new Error(`Theme "${themeId}" defines unknown icon slot "${slot}"`);
    }
    if (!isValidThemeIconValue(value)) {
      throw new Error(`Theme "${themeId}" defines invalid icon value for "${slot}"`);
    }
  });
}

function validateLayoutSection(themeId: string, section: ThemeManifest['layout']) {
  if (!section) {
    return;
  }
  Object.entries(section).forEach(([slot, value]) => {
    if (!isThemeLayoutSlot(slot)) {
      throw new Error(`Theme "${themeId}" defines unknown layout slot "${slot}"`);
    }
    if (!isValidThemeLayoutValue(value)) {
      throw new Error(`Theme "${themeId}" defines invalid layout value for "${slot}"`);
    }
  });
}
