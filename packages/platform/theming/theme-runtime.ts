import {
  createDefaultThemeRegistry,
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
  type ResolvedThemeDefinition,
  type ThemeBase,
  type ThemeColorSlot,
  type ThemeColorTokens,
  type ThemeIconSlot,
  type ThemeIconTokens,
  type ThemeLayoutSlot,
  type ThemeLayoutTokens,
  type ThemeRegistry,
  type ThemeSpacingSlot,
  type ThemeSpacingTokens,
  type ThemeTypographySlot,
  type ThemeTypographyTokens
} from './theme-registry';
import { toCssVariables } from './theme-token-catalog';

export type ThemeOverrideScope = 'default' | 'user' | 'workspace' | 'contrast';

export type ThemeTokenOverrides = {
  readonly colors?: Partial<Record<ThemeColorSlot, string>>;
  readonly typography?: Partial<Record<ThemeTypographySlot, string>>;
  readonly spacing?: Partial<Record<ThemeSpacingSlot, string>>;
  readonly icons?: Partial<Record<ThemeIconSlot, string>>;
  readonly layout?: Partial<Record<ThemeLayoutSlot, string>>;
};

export type ThemeRuntimeSnapshot = {
  readonly theme: ResolvedThemeDefinition;
  readonly activeThemeId: string;
  readonly fallbackThemeId: string;
  readonly revision: number;
  readonly colors: ThemeColorTokens;
  readonly typography: ThemeTypographyTokens;
  readonly spacing: ThemeSpacingTokens;
  readonly icons: ThemeIconTokens;
  readonly layout: ThemeLayoutTokens;
  readonly cssVariables: Record<string, string>;
  readonly overrides: Readonly<Record<ThemeOverrideScope, ThemeTokenOverrides>>;
};

export type ThemeRuntimeChangeEvent = {
  readonly snapshot: ThemeRuntimeSnapshot;
  readonly reason: 'theme' | 'overrides';
  readonly scope?: ThemeOverrideScope;
};

export type ThemeRuntimeListener = (event: ThemeRuntimeChangeEvent) => void;

export type ThemeRuntimeOptions = {
  registry?: ThemeRegistry;
  initialThemeId?: string;
  fallbackThemeId?: string;
  initialOverrides?: Partial<Record<ThemeOverrideScope, ThemeTokenOverrides>>;
};

export type RuntimeMonacoThemeDefinition = {
  base: ThemeBase;
  inherit: boolean;
  foreground: string;
  background: string;
  selection: string;
  inactiveSelection: string;
  lineHighlight: string;
  lineNumber: string;
  cursor: string;
  comments: string;
  findMatchBackground: string;
  findMatchBorder: string;
  whitespace: string;
  indentGuide: string;
  activeIndentGuide: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
};

export type RuntimeTerminalThemeDefinition = {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
};

const OVERRIDE_SCOPE_ORDER: readonly ThemeOverrideScope[] = ['default', 'user', 'workspace', 'contrast'] as const;

function createEmptyOverrideState(): Record<ThemeOverrideScope, ThemeTokenOverrides> {
  return {
    default: {},
    user: {},
    workspace: {},
    contrast: {}
  };
}

function cloneOverrides(state: Record<ThemeOverrideScope, ThemeTokenOverrides>) {
  return OVERRIDE_SCOPE_ORDER.reduce<Record<ThemeOverrideScope, ThemeTokenOverrides>>((copy, scope) => {
    copy[scope] = {
      colors: { ...state[scope].colors },
      typography: { ...state[scope].typography },
      spacing: { ...state[scope].spacing },
      icons: { ...state[scope].icons },
      layout: { ...state[scope].layout }
    };
    return copy;
  }, createEmptyOverrideState());
}

export class ThemeRuntime {
  private readonly registry: ThemeRegistry;
  private readonly fallbackThemeId: string;
  private readonly listeners = new Set<ThemeRuntimeListener>();
  private readonly overrides: Record<ThemeOverrideScope, ThemeTokenOverrides>;
  private activeThemeId: string;
  private revision = 0;

  constructor(options: ThemeRuntimeOptions = {}) {
    this.registry = options.registry ?? createDefaultThemeRegistry();
    this.fallbackThemeId = this.resolveExistingThemeId(options.fallbackThemeId ?? 'Nexus Dark', 'Nexus Dark');
    this.activeThemeId = this.resolveExistingThemeId(options.initialThemeId ?? this.fallbackThemeId, this.fallbackThemeId);
    this.overrides = createEmptyOverrideState();
    OVERRIDE_SCOPE_ORDER.forEach(scope => {
      const values = options.initialOverrides?.[scope];
      if (values) {
        this.overrides[scope] = normalizeOverrides(values, scope);
      }
    });
  }

  getSnapshot(): ThemeRuntimeSnapshot {
    const theme = this.resolveTheme(this.activeThemeId);
    const colors = OVERRIDE_SCOPE_ORDER.reduce<ThemeColorTokens>(
      (merged, scope) => ({ ...merged, ...this.overrides[scope].colors }),
      { ...theme.colors }
    );
    const typography = OVERRIDE_SCOPE_ORDER.reduce<ThemeTypographyTokens>(
      (merged, scope) => ({ ...merged, ...this.overrides[scope].typography }),
      { ...theme.typography }
    );
    const spacing = OVERRIDE_SCOPE_ORDER.reduce<ThemeSpacingTokens>(
      (merged, scope) => ({ ...merged, ...this.overrides[scope].spacing }),
      { ...theme.spacing }
    );
    const icons = OVERRIDE_SCOPE_ORDER.reduce<ThemeIconTokens>(
      (merged, scope) => ({ ...merged, ...this.overrides[scope].icons }),
      { ...theme.icons }
    );
    const layout = OVERRIDE_SCOPE_ORDER.reduce<ThemeLayoutTokens>(
      (merged, scope) => ({ ...merged, ...this.overrides[scope].layout }),
      { ...theme.layout }
    );

    return {
      theme,
      activeThemeId: theme.id,
      fallbackThemeId: this.fallbackThemeId,
      revision: this.revision,
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
      overrides: cloneOverrides(this.overrides)
    };
  }

  onDidChange(listener: ThemeRuntimeListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setTheme(themeId: string) {
    const resolvedThemeId = this.resolveExistingThemeId(themeId, this.fallbackThemeId);
    if (resolvedThemeId === this.activeThemeId) {
      return this.getSnapshot();
    }
    this.activeThemeId = resolvedThemeId;
    this.revision += 1;
    return this.emitChange({ reason: 'theme' });
  }

  setOverrides(scope: ThemeOverrideScope, overrides: ThemeTokenOverrides) {
    const normalized = normalizeOverrides(overrides, scope);
    if (isOverrideStateEqual(this.overrides[scope], normalized)) {
      return this.getSnapshot();
    }
    this.overrides[scope] = normalized;
    this.revision += 1;
    return this.emitChange({ reason: 'overrides', scope });
  }

  clearOverrides(scope: ThemeOverrideScope) {
    if (isOverrideStateEqual(this.overrides[scope], {})) {
      return this.getSnapshot();
    }
    this.overrides[scope] = {};
    this.revision += 1;
    return this.emitChange({ reason: 'overrides', scope });
  }

  private emitChange(details: { reason: 'theme' | 'overrides'; scope?: ThemeOverrideScope }) {
    const snapshot = this.getSnapshot();
    const event: ThemeRuntimeChangeEvent = {
      snapshot,
      reason: details.reason,
      scope: details.scope
    };
    this.listeners.forEach(listener => listener(event));
    return snapshot;
  }

  private resolveExistingThemeId(themeId: string, fallbackThemeId: string) {
    if (this.registry.has(themeId)) {
      return themeId;
    }
    return fallbackThemeId;
  }

  private resolveTheme(themeId: string) {
    if (this.registry.has(themeId)) {
      return this.registry.resolve(themeId);
    }
    return this.registry.resolve(this.fallbackThemeId);
  }
}

export function toMonacoThemeDefinition(snapshot: ThemeRuntimeSnapshot): RuntimeMonacoThemeDefinition {
  return {
    base: snapshot.theme.uiBaseTheme,
    inherit: true,
    foreground: snapshot.colors['editor.foreground'],
    background: snapshot.colors['editor.background'],
    selection: snapshot.colors['editor.selectionBackground'],
    inactiveSelection: snapshot.colors['editor.inactiveSelectionBackground'],
    lineHighlight: snapshot.colors['editor.lineHighlightBackground'],
    lineNumber: snapshot.colors['editor.lineNumberForeground'],
    cursor: snapshot.colors['editor.cursorForeground'],
    comments: snapshot.colors['editor.commentForeground'],
    findMatchBackground: snapshot.colors['editor.findMatchBackground'],
    findMatchBorder: snapshot.colors['editor.findMatchBorder'],
    whitespace: snapshot.colors['editorWhitespace.foreground'],
    indentGuide: snapshot.colors['editorIndentGuide.background'],
    activeIndentGuide: snapshot.colors['editorIndentGuide.activeBackground'],
    fontFamily: snapshot.typography['font.family.mono'],
    fontSize: parseLengthToken(snapshot.typography['font.size.md'], 13),
    lineHeight: parseLineHeightToken(
      snapshot.typography['font.lineHeight.normal'],
      parseLengthToken(snapshot.typography['font.size.md'], 13)
    )
  };
}

export function toTerminalThemeDefinition(snapshot: ThemeRuntimeSnapshot): RuntimeTerminalThemeDefinition {
  return {
    background: snapshot.colors['terminal.background'],
    foreground: snapshot.colors['terminal.foreground'],
    cursor: snapshot.colors['terminalCursor.foreground'],
    selectionBackground: snapshot.colors['terminal.selectionBackground'],
    black: snapshot.colors['terminalAnsi.black'],
    red: snapshot.colors['terminalAnsi.red'],
    green: snapshot.colors['terminalAnsi.green'],
    yellow: snapshot.colors['terminalAnsi.yellow'],
    blue: snapshot.colors['terminalAnsi.blue'],
    magenta: snapshot.colors['terminalAnsi.magenta'],
    cyan: snapshot.colors['terminalAnsi.cyan'],
    white: snapshot.colors['terminalAnsi.white'],
    brightBlack: snapshot.colors['terminalAnsi.brightBlack'],
    brightRed: snapshot.colors['terminalAnsi.brightRed'],
    brightGreen: snapshot.colors['terminalAnsi.brightGreen'],
    brightYellow: snapshot.colors['terminalAnsi.brightYellow'],
    brightBlue: snapshot.colors['terminalAnsi.brightBlue'],
    brightMagenta: snapshot.colors['terminalAnsi.brightMagenta'],
    brightCyan: snapshot.colors['terminalAnsi.brightCyan'],
    brightWhite: snapshot.colors['terminalAnsi.brightWhite'],
    fontFamily: snapshot.typography['font.family.mono'],
    fontSize: parseLengthToken(snapshot.typography['font.size.md'], 13),
    lineHeight: parseLineHeightToken(
      snapshot.typography['font.lineHeight.normal'],
      parseLengthToken(snapshot.typography['font.size.md'], 13)
    )
  };
}

export function createDefaultThemeRuntime(options: Omit<ThemeRuntimeOptions, 'registry'> & { registry?: ThemeRegistry } = {}) {
  return new ThemeRuntime(options);
}

function normalizeOverrides(overrides: ThemeTokenOverrides, scope: ThemeOverrideScope): ThemeTokenOverrides {
  return {
    colors: normalizeColorOverrides(overrides.colors, scope),
    typography: normalizeTypographyOverrides(overrides.typography, scope),
    spacing: normalizeSpacingOverrides(overrides.spacing, scope),
    icons: normalizeIconOverrides(overrides.icons, scope),
    layout: normalizeLayoutOverrides(overrides.layout, scope)
  };
}

function normalizeColorOverrides(
  overrides: ThemeTokenOverrides['colors'],
  scope: ThemeOverrideScope
): ThemeTokenOverrides['colors'] {
  if (!overrides) {
    return undefined;
  }
  return Object.entries(overrides).reduce<NonNullable<ThemeTokenOverrides['colors']>>((normalized, [slot, value]) => {
    if (!isThemeColorSlot(slot)) {
      throw new Error(`Theme override scope "${scope}" defines unknown color slot "${slot}"`);
    }
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    if (!normalizedValue || !isValidThemeColorValue(normalizedValue)) {
      throw new Error(`Theme override scope "${scope}" defines invalid color value for "${slot}"`);
    }
    normalized[slot] = normalizedValue;
    return normalized;
  }, {});
}

function normalizeTypographyOverrides(
  overrides: ThemeTokenOverrides['typography'],
  scope: ThemeOverrideScope
): ThemeTokenOverrides['typography'] {
  if (!overrides) {
    return undefined;
  }
  return Object.entries(overrides).reduce<NonNullable<ThemeTokenOverrides['typography']>>((normalized, [slot, value]) => {
    if (!isThemeTypographySlot(slot)) {
      throw new Error(`Theme override scope "${scope}" defines unknown typography slot "${slot}"`);
    }
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    if (!normalizedValue || !isValidThemeTypographyValue(slot, normalizedValue)) {
      throw new Error(`Theme override scope "${scope}" defines invalid typography value for "${slot}"`);
    }
    normalized[slot] = normalizedValue;
    return normalized;
  }, {});
}

function normalizeSpacingOverrides(
  overrides: ThemeTokenOverrides['spacing'],
  scope: ThemeOverrideScope
): ThemeTokenOverrides['spacing'] {
  if (!overrides) {
    return undefined;
  }
  return Object.entries(overrides).reduce<NonNullable<ThemeTokenOverrides['spacing']>>((normalized, [slot, value]) => {
    if (!isThemeSpacingSlot(slot)) {
      throw new Error(`Theme override scope "${scope}" defines unknown spacing slot "${slot}"`);
    }
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    if (!normalizedValue || !isValidThemeSpacingValue(normalizedValue)) {
      throw new Error(`Theme override scope "${scope}" defines invalid spacing value for "${slot}"`);
    }
    normalized[slot] = normalizedValue;
    return normalized;
  }, {});
}

function normalizeIconOverrides(
  overrides: ThemeTokenOverrides['icons'],
  scope: ThemeOverrideScope
): ThemeTokenOverrides['icons'] {
  if (!overrides) {
    return undefined;
  }
  return Object.entries(overrides).reduce<NonNullable<ThemeTokenOverrides['icons']>>((normalized, [slot, value]) => {
    if (!isThemeIconSlot(slot)) {
      throw new Error(`Theme override scope "${scope}" defines unknown icon slot "${slot}"`);
    }
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    if (!normalizedValue || !isValidThemeIconValue(normalizedValue)) {
      throw new Error(`Theme override scope "${scope}" defines invalid icon value for "${slot}"`);
    }
    normalized[slot] = normalizedValue;
    return normalized;
  }, {});
}

function normalizeLayoutOverrides(
  overrides: ThemeTokenOverrides['layout'],
  scope: ThemeOverrideScope
): ThemeTokenOverrides['layout'] {
  if (!overrides) {
    return undefined;
  }
  return Object.entries(overrides).reduce<NonNullable<ThemeTokenOverrides['layout']>>((normalized, [slot, value]) => {
    if (!isThemeLayoutSlot(slot)) {
      throw new Error(`Theme override scope "${scope}" defines unknown layout slot "${slot}"`);
    }
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    if (!normalizedValue || !isValidThemeLayoutValue(normalizedValue)) {
      throw new Error(`Theme override scope "${scope}" defines invalid layout value for "${slot}"`);
    }
    normalized[slot] = normalizedValue;
    return normalized;
  }, {});
}

function isOverrideStateEqual(left: ThemeTokenOverrides, right: ThemeTokenOverrides) {
  return (
    isSectionEqual(left.colors, right.colors) &&
    isSectionEqual(left.typography, right.typography) &&
    isSectionEqual(left.spacing, right.spacing) &&
    isSectionEqual(left.icons, right.icons) &&
    isSectionEqual(left.layout, right.layout)
  );
}

function isSectionEqual<TValue extends Record<string, string> | undefined>(left: TValue, right: TValue) {
  const leftEntries = Object.entries(left ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const rightEntries = Object.entries(right ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (leftEntries.length !== rightEntries.length) {
    return false;
  }
  return leftEntries.every(([slot, value], index) => {
    const [otherSlot, otherValue] = rightEntries[index] ?? [];
    return slot === otherSlot && value === otherValue;
  });
}

function parseLengthToken(value: string, fallback: number) {
  const normalized = value.trim();
  if (/^[0-9]+(?:\.[0-9]+)?px$/.test(normalized)) {
    return Number.parseFloat(normalized);
  }
  if (/^[0-9]+(?:\.[0-9]+)?$/.test(normalized)) {
    return Number.parseFloat(normalized);
  }
  if (/^[0-9]+(?:\.[0-9]+)?rem$/.test(normalized) || /^[0-9]+(?:\.[0-9]+)?em$/.test(normalized)) {
    return Number.parseFloat(normalized) * 16;
  }
  return fallback;
}

function parseLineHeightToken(value: string, fontSize: number) {
  const normalized = value.trim();
  if (normalized === 'normal') {
    return Math.round(fontSize * 1.5);
  }
  if (/^[0-9]+(?:\.[0-9]+)?$/.test(normalized)) {
    return Math.round(fontSize * Number.parseFloat(normalized));
  }
  return parseLengthToken(normalized, Math.round(fontSize * 1.5));
}
