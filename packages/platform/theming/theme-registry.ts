export const THEME_COLOR_SLOTS = [
  'workbench.background',
  'activityBar.background',
  'sidebar.background',
  'panel.background',
  'statusBar.background',
  'statusBar.foreground',
  'editor.background',
  'editor.foreground',
  'editor.selectionBackground',
  'editor.lineHighlightBackground',
  'editor.commentForeground',
  'terminal.background',
  'terminal.foreground'
] as const;

export type ThemeColorSlot = (typeof THEME_COLOR_SLOTS)[number];
export type ThemeKind = 'light' | 'dark' | 'high-contrast';
export type ThemeBase = 'vs' | 'vs-dark' | 'hc-black';

export type ThemeManifest = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly kind: ThemeKind;
  readonly extends?: string;
  readonly uiBaseTheme?: ThemeBase;
  readonly colors: Partial<Record<ThemeColorSlot, string>>;
};

export type ResolvedThemeDefinition = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly kind: ThemeKind;
  readonly extends?: string;
  readonly uiBaseTheme: ThemeBase;
  readonly colors: Record<ThemeColorSlot, string>;
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

const CSS_COLOR_PATTERN =
  /^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgb|hsl)a?\([^)]+\)|var\(--[A-Za-z0-9-_]+\))$/;

const THEME_BASE_BY_KIND: Record<ThemeKind, ThemeBase> = {
  light: 'vs',
  dark: 'vs-dark',
  'high-contrast': 'hc-black'
};

const CSS_VARIABLES_BY_SLOT: Record<ThemeColorSlot, string> = {
  'workbench.background': '--nexus-workbench-bg',
  'activityBar.background': '--nexus-activity-bar-bg',
  'sidebar.background': '--nexus-sidebar-bg',
  'panel.background': '--nexus-panel-bg',
  'statusBar.background': '--nexus-status-bar-bg',
  'statusBar.foreground': '--nexus-status-bar-fg',
  'editor.background': '--nexus-editor-bg',
  'editor.foreground': '--nexus-editor-fg',
  'editor.selectionBackground': '--nexus-editor-selection-bg',
  'editor.lineHighlightBackground': '--nexus-editor-line-highlight-bg',
  'editor.commentForeground': '--nexus-editor-comment-fg',
  'terminal.background': '--nexus-terminal-bg',
  'terminal.foreground': '--nexus-terminal-fg'
};

const DEFAULT_THEME_COLORS_BY_KIND: Record<ThemeKind, Record<ThemeColorSlot, string>> = {
  dark: {
    'workbench.background': '#1e1e1e',
    'activityBar.background': '#252526',
    'sidebar.background': '#1f1f1f',
    'panel.background': '#181818',
    'statusBar.background': '#0d5cab',
    'statusBar.foreground': '#ffffff',
    'editor.background': '#1e1e1e',
    'editor.foreground': '#d4d4d4',
    'editor.selectionBackground': '#264f78',
    'editor.lineHighlightBackground': '#2b2b2b50',
    'editor.commentForeground': '#6a9955',
    'terminal.background': '#181818',
    'terminal.foreground': '#ffffff'
  },
  light: {
    'workbench.background': '#f5f5f5',
    'activityBar.background': '#e3e3e3',
    'sidebar.background': '#ffffff',
    'panel.background': '#fafafa',
    'statusBar.background': '#005fb8',
    'statusBar.foreground': '#ffffff',
    'editor.background': '#ffffff',
    'editor.foreground': '#24292f',
    'editor.selectionBackground': '#add6ff',
    'editor.lineHighlightBackground': '#f0f6fc',
    'editor.commentForeground': '#6e7781',
    'terminal.background': '#ffffff',
    'terminal.foreground': '#24292f'
  },
  'high-contrast': {
    'workbench.background': '#000000',
    'activityBar.background': '#000000',
    'sidebar.background': '#050505',
    'panel.background': '#050505',
    'statusBar.background': '#ffff00',
    'statusBar.foreground': '#000000',
    'editor.background': '#000000',
    'editor.foreground': '#ffffff',
    'editor.selectionBackground': '#f38518',
    'editor.lineHighlightBackground': '#1a1a1a',
    'editor.commentForeground': '#7ca668',
    'terminal.background': '#000000',
    'terminal.foreground': '#ffffff'
  }
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
  required: ['id', 'label', 'kind', 'colors'],
  properties: {
    id: { type: 'string', minLength: 1 },
    label: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    kind: { type: 'string', enum: ['light', 'dark', 'high-contrast'] },
    extends: { type: 'string', minLength: 1 },
    uiBaseTheme: { type: 'string', enum: ['vs', 'vs-dark', 'hc-black'] },
    colors: {
      type: 'object',
      additionalProperties: false,
      propertyNames: {
        enum: [...THEME_COLOR_SLOTS]
      },
      patternProperties: {
        '.*': { type: 'string', minLength: 1 }
      }
    }
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
    const baseColors = inherited ? inherited.colors : DEFAULT_THEME_COLORS_BY_KIND[manifest.kind];
    const colors = {
      ...baseColors,
      ...manifest.colors
    } as Record<ThemeColorSlot, string>;
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
      cssVariables: toCssVariables(colors),
      inheritanceChain
    };
  }
}

export function createDefaultThemeRegistry() {
  const registry = new ThemeRegistry();
  registry.registerMany(BUILTIN_THEME_MANIFESTS);
  return registry;
}

export function toCssVariables(colors: Record<ThemeColorSlot, string>) {
  return THEME_COLOR_SLOTS.reduce<Record<string, string>>((variables, slot) => {
    variables[CSS_VARIABLES_BY_SLOT[slot]] = colors[slot];
    return variables;
  }, {});
}

function normalizeManifest(manifest: ThemeManifest): ThemeManifest {
  return {
    ...manifest,
    id: manifest.id.trim(),
    label: manifest.label.trim(),
    description: manifest.description?.trim(),
    extends: manifest.extends?.trim(),
    colors: Object.entries(manifest.colors).reduce<Partial<Record<ThemeColorSlot, string>>>((normalized, [slot, value]) => {
      normalized[slot as ThemeColorSlot] = value.trim();
      return normalized;
    }, {})
  };
}

function validateManifest(manifest: ThemeManifest) {
  if (!manifest.id) {
    throw new Error('Theme id is required');
  }
  if (!manifest.label) {
    throw new Error(`Theme "${manifest.id}" must have a label`);
  }
  if (!manifest.colors || typeof manifest.colors !== 'object' || Array.isArray(manifest.colors)) {
    throw new Error(`Theme "${manifest.id}" must declare a colors object`);
  }

  Object.entries(manifest.colors).forEach(([slot, value]) => {
    if (!THEME_COLOR_SLOTS.includes(slot as ThemeColorSlot)) {
      throw new Error(`Theme "${manifest.id}" defines unknown color slot "${slot}"`);
    }
    if (!CSS_COLOR_PATTERN.test(value)) {
      throw new Error(`Theme "${manifest.id}" defines invalid color value for "${slot}"`);
    }
  });
}
