export type ThemeKind = 'light' | 'dark' | 'high-contrast';
export type ThemeBase = 'vs' | 'vs-dark' | 'hc-black';

export const THEME_COLOR_SLOTS = [
  'foreground',
  'disabledForeground',
  'border',
  'focusBorder',
  'selectionBackground',
  'selectionForeground',
  'workbench.background',
  'activityBar.background',
  'activityBar.foreground',
  'activityBar.inactiveForeground',
  'activityBar.activeBorder',
  'activityBar.badgeBackground',
  'activityBar.badgeForeground',
  'sidebar.background',
  'sidebar.foreground',
  'sidebar.border',
  'sidebar.titleForeground',
  'panel.background',
  'panel.foreground',
  'panel.border',
  'panelTitle.activeForeground',
  'panelTitle.inactiveForeground',
  'statusBar.background',
  'statusBar.foreground',
  'statusBar.debuggingBackground',
  'statusBar.warningBackground',
  'statusBar.errorBackground',
  'tab.activeBackground',
  'tab.activeForeground',
  'tab.inactiveBackground',
  'tab.inactiveForeground',
  'tab.border',
  'list.hoverBackground',
  'list.activeSelectionBackground',
  'list.activeSelectionForeground',
  'list.inactiveSelectionBackground',
  'list.inactiveSelectionForeground',
  'button.background',
  'button.foreground',
  'button.hoverBackground',
  'button.secondaryBackground',
  'button.secondaryForeground',
  'input.background',
  'input.foreground',
  'input.border',
  'input.placeholderForeground',
  'notification.background',
  'notification.foreground',
  'tooltip.background',
  'tooltip.foreground',
  'menu.background',
  'menu.foreground',
  'menu.selectionBackground',
  'menu.selectionForeground',
  'editor.background',
  'editor.foreground',
  'editor.selectionBackground',
  'editor.inactiveSelectionBackground',
  'editor.lineHighlightBackground',
  'editor.lineNumberForeground',
  'editor.cursorForeground',
  'editor.commentForeground',
  'editor.findMatchBackground',
  'editor.findMatchBorder',
  'editorWhitespace.foreground',
  'editorIndentGuide.background',
  'editorIndentGuide.activeBackground',
  'editorGutter.addedBackground',
  'editorGutter.modifiedBackground',
  'editorGutter.deletedBackground',
  'scm.addedForeground',
  'scm.modifiedForeground',
  'scm.deletedForeground',
  'scm.untrackedForeground',
  'scm.conflictingForeground',
  'errorForeground',
  'warningForeground',
  'infoForeground',
  'successForeground',
  'terminal.background',
  'terminal.foreground',
  'terminalCursor.foreground',
  'terminal.selectionBackground',
  'terminalAnsi.black',
  'terminalAnsi.red',
  'terminalAnsi.green',
  'terminalAnsi.yellow',
  'terminalAnsi.blue',
  'terminalAnsi.magenta',
  'terminalAnsi.cyan',
  'terminalAnsi.white',
  'terminalAnsi.brightBlack',
  'terminalAnsi.brightRed',
  'terminalAnsi.brightGreen',
  'terminalAnsi.brightYellow',
  'terminalAnsi.brightBlue',
  'terminalAnsi.brightMagenta',
  'terminalAnsi.brightCyan',
  'terminalAnsi.brightWhite'
] as const;

export const THEME_TYPOGRAPHY_SLOTS = [
  'font.family.ui',
  'font.family.mono',
  'font.size.xs',
  'font.size.sm',
  'font.size.md',
  'font.size.lg',
  'font.size.xl',
  'font.weight.regular',
  'font.weight.medium',
  'font.weight.semibold',
  'font.lineHeight.tight',
  'font.lineHeight.normal',
  'font.lineHeight.relaxed'
] as const;

export const THEME_SPACING_SLOTS = [
  'space.0',
  'space.1',
  'space.2',
  'space.3',
  'space.4',
  'space.5',
  'space.6',
  'space.8',
  'space.10',
  'space.12',
  'radius.sm',
  'radius.md',
  'radius.lg',
  'focus.outlineWidth'
] as const;

export const THEME_ICON_SLOTS = [
  'icon.size.xs',
  'icon.size.sm',
  'icon.size.md',
  'icon.size.lg',
  'icon.size.xl'
] as const;

export const THEME_LAYOUT_SLOTS = [
  'activityBar.width',
  'statusBar.height',
  'tab.height',
  'sidebar.headerHeight',
  'panel.headerHeight',
  'control.height.sm',
  'control.height.md',
  'control.height.lg'
] as const;

export type ThemeColorSlot = (typeof THEME_COLOR_SLOTS)[number];
export type ThemeTypographySlot = (typeof THEME_TYPOGRAPHY_SLOTS)[number];
export type ThemeSpacingSlot = (typeof THEME_SPACING_SLOTS)[number];
export type ThemeIconSlot = (typeof THEME_ICON_SLOTS)[number];
export type ThemeLayoutSlot = (typeof THEME_LAYOUT_SLOTS)[number];

export type ThemeColorTokens = Record<ThemeColorSlot, string>;
export type ThemeTypographyTokens = Record<ThemeTypographySlot, string>;
export type ThemeSpacingTokens = Record<ThemeSpacingSlot, string>;
export type ThemeIconTokens = Record<ThemeIconSlot, string>;
export type ThemeLayoutTokens = Record<ThemeLayoutSlot, string>;

export type ThemeDesignTokens = {
  readonly colors: ThemeColorTokens;
  readonly typography: ThemeTypographyTokens;
  readonly spacing: ThemeSpacingTokens;
  readonly icons: ThemeIconTokens;
  readonly layout: ThemeLayoutTokens;
};

export type ThemeManifestTokens = {
  readonly colors?: Partial<Record<ThemeColorSlot, string>>;
  readonly typography?: Partial<Record<ThemeTypographySlot, string>>;
  readonly spacing?: Partial<Record<ThemeSpacingSlot, string>>;
  readonly icons?: Partial<Record<ThemeIconSlot, string>>;
  readonly layout?: Partial<Record<ThemeLayoutSlot, string>>;
};

const CSS_COLOR_PATTERN =
  /^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgb|hsl)a?\([^)]+\)|var\(--[A-Za-z0-9-_]+\))$/;
const CSS_LENGTH_PATTERN = /^(?:0|[0-9]+(?:\.[0-9]+)?(?:px|rem|em|%)?)$/;
const CSS_LINE_HEIGHT_PATTERN = /^(?:normal|[0-9]+(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?(?:px|rem|em|%))$/;
const FONT_WEIGHT_PATTERN = /^(?:normal|bold|[1-9]00)$/;

export const THEME_CSS_VARIABLES_BY_SLOT = buildCssVariableMap(THEME_COLOR_SLOTS);
export const THEME_TYPOGRAPHY_CSS_VARIABLES_BY_SLOT = buildCssVariableMap(THEME_TYPOGRAPHY_SLOTS);
export const THEME_SPACING_CSS_VARIABLES_BY_SLOT = buildCssVariableMap(THEME_SPACING_SLOTS);
export const THEME_ICON_CSS_VARIABLES_BY_SLOT = buildCssVariableMap(THEME_ICON_SLOTS);
export const THEME_LAYOUT_CSS_VARIABLES_BY_SLOT = buildCssVariableMap(THEME_LAYOUT_SLOTS);

const BASE_DARK_COLORS: ThemeColorTokens = {
  foreground: '#cccccc',
  disabledForeground: '#7f7f7f',
  border: '#3c3c3c',
  focusBorder: '#007fd4',
  selectionBackground: '#04395e',
  selectionForeground: '#ffffff',
  'workbench.background': '#1e1e1e',
  'activityBar.background': '#181818',
  'activityBar.foreground': '#ffffff',
  'activityBar.inactiveForeground': '#8b8b8b',
  'activityBar.activeBorder': '#007fd4',
  'activityBar.badgeBackground': '#0078d4',
  'activityBar.badgeForeground': '#ffffff',
  'sidebar.background': '#1f1f1f',
  'sidebar.foreground': '#cccccc',
  'sidebar.border': '#2b2b2b',
  'sidebar.titleForeground': '#ffffff',
  'panel.background': '#181818',
  'panel.foreground': '#cccccc',
  'panel.border': '#2b2b2b',
  'panelTitle.activeForeground': '#ffffff',
  'panelTitle.inactiveForeground': '#9d9d9d',
  'statusBar.background': '#0d5cab',
  'statusBar.foreground': '#ffffff',
  'statusBar.debuggingBackground': '#b35d00',
  'statusBar.warningBackground': '#8a5d00',
  'statusBar.errorBackground': '#a1260d',
  'tab.activeBackground': '#1e1e1e',
  'tab.activeForeground': '#ffffff',
  'tab.inactiveBackground': '#252526',
  'tab.inactiveForeground': '#9d9d9d',
  'tab.border': '#2b2b2b',
  'list.hoverBackground': '#2a2d2e',
  'list.activeSelectionBackground': '#094771',
  'list.activeSelectionForeground': '#ffffff',
  'list.inactiveSelectionBackground': '#37373d',
  'list.inactiveSelectionForeground': '#f0f0f0',
  'button.background': '#0e639c',
  'button.foreground': '#ffffff',
  'button.hoverBackground': '#1177bb',
  'button.secondaryBackground': '#3a3d41',
  'button.secondaryForeground': '#ffffff',
  'input.background': '#313131',
  'input.foreground': '#cccccc',
  'input.border': '#3c3c3c',
  'input.placeholderForeground': '#8b8b8b',
  'notification.background': '#252526',
  'notification.foreground': '#cccccc',
  'tooltip.background': '#252526',
  'tooltip.foreground': '#f0f0f0',
  'menu.background': '#252526',
  'menu.foreground': '#f0f0f0',
  'menu.selectionBackground': '#094771',
  'menu.selectionForeground': '#ffffff',
  'editor.background': '#1e1e1e',
  'editor.foreground': '#d4d4d4',
  'editor.selectionBackground': '#264f78',
  'editor.inactiveSelectionBackground': '#3a3d4166',
  'editor.lineHighlightBackground': '#2b2b2b50',
  'editor.lineNumberForeground': '#858585',
  'editor.cursorForeground': '#aeafad',
  'editor.commentForeground': '#6a9955',
  'editor.findMatchBackground': '#515c6a',
  'editor.findMatchBorder': '#ea5c0055',
  'editorWhitespace.foreground': '#404040',
  'editorIndentGuide.background': '#404040',
  'editorIndentGuide.activeBackground': '#707070',
  'editorGutter.addedBackground': '#2ea043',
  'editorGutter.modifiedBackground': '#e2c08d',
  'editorGutter.deletedBackground': '#f85149',
  'scm.addedForeground': '#2ea043',
  'scm.modifiedForeground': '#e2c08d',
  'scm.deletedForeground': '#f85149',
  'scm.untrackedForeground': '#3fb950',
  'scm.conflictingForeground': '#db6d28',
  errorForeground: '#f85149',
  warningForeground: '#d29922',
  infoForeground: '#58a6ff',
  successForeground: '#3fb950',
  'terminal.background': '#181818',
  'terminal.foreground': '#ffffff',
  'terminalCursor.foreground': '#ffffff',
  'terminal.selectionBackground': '#264f78',
  'terminalAnsi.black': '#000000',
  'terminalAnsi.red': '#cd3131',
  'terminalAnsi.green': '#0dbc79',
  'terminalAnsi.yellow': '#e5e510',
  'terminalAnsi.blue': '#2472c8',
  'terminalAnsi.magenta': '#bc3fbc',
  'terminalAnsi.cyan': '#11a8cd',
  'terminalAnsi.white': '#e5e5e5',
  'terminalAnsi.brightBlack': '#666666',
  'terminalAnsi.brightRed': '#f14c4c',
  'terminalAnsi.brightGreen': '#23d18b',
  'terminalAnsi.brightYellow': '#f5f543',
  'terminalAnsi.brightBlue': '#3b8eea',
  'terminalAnsi.brightMagenta': '#d670d6',
  'terminalAnsi.brightCyan': '#29b8db',
  'terminalAnsi.brightWhite': '#ffffff'
};

const BASE_LIGHT_COLORS: ThemeColorTokens = {
  foreground: '#24292f',
  disabledForeground: '#8c959f',
  border: '#d0d7de',
  focusBorder: '#0969da',
  selectionBackground: '#cce5ff',
  selectionForeground: '#24292f',
  'workbench.background': '#f5f5f5',
  'activityBar.background': '#e7ecf2',
  'activityBar.foreground': '#1f2328',
  'activityBar.inactiveForeground': '#6e7781',
  'activityBar.activeBorder': '#0969da',
  'activityBar.badgeBackground': '#0969da',
  'activityBar.badgeForeground': '#ffffff',
  'sidebar.background': '#ffffff',
  'sidebar.foreground': '#24292f',
  'sidebar.border': '#d8dee4',
  'sidebar.titleForeground': '#1f2328',
  'panel.background': '#f6f8fa',
  'panel.foreground': '#24292f',
  'panel.border': '#d8dee4',
  'panelTitle.activeForeground': '#1f2328',
  'panelTitle.inactiveForeground': '#6e7781',
  'statusBar.background': '#005fb8',
  'statusBar.foreground': '#ffffff',
  'statusBar.debuggingBackground': '#b35d00',
  'statusBar.warningBackground': '#9a6700',
  'statusBar.errorBackground': '#cf222e',
  'tab.activeBackground': '#ffffff',
  'tab.activeForeground': '#1f2328',
  'tab.inactiveBackground': '#f6f8fa',
  'tab.inactiveForeground': '#6e7781',
  'tab.border': '#d8dee4',
  'list.hoverBackground': '#f3f4f6',
  'list.activeSelectionBackground': '#cce5ff',
  'list.activeSelectionForeground': '#1f2328',
  'list.inactiveSelectionBackground': '#eaeef2',
  'list.inactiveSelectionForeground': '#24292f',
  'button.background': '#0969da',
  'button.foreground': '#ffffff',
  'button.hoverBackground': '#0860ca',
  'button.secondaryBackground': '#eaeef2',
  'button.secondaryForeground': '#24292f',
  'input.background': '#ffffff',
  'input.foreground': '#24292f',
  'input.border': '#d0d7de',
  'input.placeholderForeground': '#8c959f',
  'notification.background': '#ffffff',
  'notification.foreground': '#24292f',
  'tooltip.background': '#24292f',
  'tooltip.foreground': '#ffffff',
  'menu.background': '#ffffff',
  'menu.foreground': '#24292f',
  'menu.selectionBackground': '#dbeafe',
  'menu.selectionForeground': '#1f2328',
  'editor.background': '#ffffff',
  'editor.foreground': '#24292f',
  'editor.selectionBackground': '#add6ff',
  'editor.inactiveSelectionBackground': '#dce9f8',
  'editor.lineHighlightBackground': '#f0f6fc',
  'editor.lineNumberForeground': '#6e7781',
  'editor.cursorForeground': '#24292f',
  'editor.commentForeground': '#6e7781',
  'editor.findMatchBackground': '#fff8c5',
  'editor.findMatchBorder': '#b08800',
  'editorWhitespace.foreground': '#d0d7de',
  'editorIndentGuide.background': '#d0d7de',
  'editorIndentGuide.activeBackground': '#8c959f',
  'editorGutter.addedBackground': '#1a7f37',
  'editorGutter.modifiedBackground': '#9a6700',
  'editorGutter.deletedBackground': '#cf222e',
  'scm.addedForeground': '#1a7f37',
  'scm.modifiedForeground': '#9a6700',
  'scm.deletedForeground': '#cf222e',
  'scm.untrackedForeground': '#1f883d',
  'scm.conflictingForeground': '#bc4c00',
  errorForeground: '#cf222e',
  warningForeground: '#9a6700',
  infoForeground: '#0969da',
  successForeground: '#1a7f37',
  'terminal.background': '#ffffff',
  'terminal.foreground': '#24292f',
  'terminalCursor.foreground': '#24292f',
  'terminal.selectionBackground': '#add6ff',
  'terminalAnsi.black': '#24292f',
  'terminalAnsi.red': '#cf222e',
  'terminalAnsi.green': '#1a7f37',
  'terminalAnsi.yellow': '#9a6700',
  'terminalAnsi.blue': '#0969da',
  'terminalAnsi.magenta': '#8250df',
  'terminalAnsi.cyan': '#0a7ea4',
  'terminalAnsi.white': '#6e7781',
  'terminalAnsi.brightBlack': '#57606a',
  'terminalAnsi.brightRed': '#d1242f',
  'terminalAnsi.brightGreen': '#2da44e',
  'terminalAnsi.brightYellow': '#bf8700',
  'terminalAnsi.brightBlue': '#218bff',
  'terminalAnsi.brightMagenta': '#a371f7',
  'terminalAnsi.brightCyan': '#1b9aaa',
  'terminalAnsi.brightWhite': '#24292f'
};

const BASE_HIGH_CONTRAST_COLORS: ThemeColorTokens = {
  foreground: '#ffffff',
  disabledForeground: '#c8c8c8',
  border: '#ffffff',
  focusBorder: '#ffff00',
  selectionBackground: '#f38518',
  selectionForeground: '#000000',
  'workbench.background': '#000000',
  'activityBar.background': '#000000',
  'activityBar.foreground': '#ffffff',
  'activityBar.inactiveForeground': '#c8c8c8',
  'activityBar.activeBorder': '#ffff00',
  'activityBar.badgeBackground': '#ffff00',
  'activityBar.badgeForeground': '#000000',
  'sidebar.background': '#050505',
  'sidebar.foreground': '#ffffff',
  'sidebar.border': '#ffffff',
  'sidebar.titleForeground': '#ffff00',
  'panel.background': '#050505',
  'panel.foreground': '#ffffff',
  'panel.border': '#ffffff',
  'panelTitle.activeForeground': '#ffff00',
  'panelTitle.inactiveForeground': '#ffffff',
  'statusBar.background': '#ffff00',
  'statusBar.foreground': '#000000',
  'statusBar.debuggingBackground': '#ff8c00',
  'statusBar.warningBackground': '#ffff00',
  'statusBar.errorBackground': '#ff0000',
  'tab.activeBackground': '#000000',
  'tab.activeForeground': '#ffff00',
  'tab.inactiveBackground': '#111111',
  'tab.inactiveForeground': '#ffffff',
  'tab.border': '#ffffff',
  'list.hoverBackground': '#1a1a1a',
  'list.activeSelectionBackground': '#f38518',
  'list.activeSelectionForeground': '#000000',
  'list.inactiveSelectionBackground': '#333333',
  'list.inactiveSelectionForeground': '#ffffff',
  'button.background': '#ffff00',
  'button.foreground': '#000000',
  'button.hoverBackground': '#ffd800',
  'button.secondaryBackground': '#000000',
  'button.secondaryForeground': '#ffffff',
  'input.background': '#000000',
  'input.foreground': '#ffffff',
  'input.border': '#ffffff',
  'input.placeholderForeground': '#c8c8c8',
  'notification.background': '#000000',
  'notification.foreground': '#ffffff',
  'tooltip.background': '#000000',
  'tooltip.foreground': '#ffffff',
  'menu.background': '#000000',
  'menu.foreground': '#ffffff',
  'menu.selectionBackground': '#f38518',
  'menu.selectionForeground': '#000000',
  'editor.background': '#000000',
  'editor.foreground': '#ffffff',
  'editor.selectionBackground': '#f38518',
  'editor.inactiveSelectionBackground': '#444444',
  'editor.lineHighlightBackground': '#1a1a1a',
  'editor.lineNumberForeground': '#ffffff',
  'editor.cursorForeground': '#ffff00',
  'editor.commentForeground': '#7ca668',
  'editor.findMatchBackground': '#ffff00',
  'editor.findMatchBorder': '#ffffff',
  'editorWhitespace.foreground': '#666666',
  'editorIndentGuide.background': '#666666',
  'editorIndentGuide.activeBackground': '#ffffff',
  'editorGutter.addedBackground': '#00ff00',
  'editorGutter.modifiedBackground': '#ffff00',
  'editorGutter.deletedBackground': '#ff0000',
  'scm.addedForeground': '#00ff00',
  'scm.modifiedForeground': '#ffff00',
  'scm.deletedForeground': '#ff0000',
  'scm.untrackedForeground': '#00ffff',
  'scm.conflictingForeground': '#ff8c00',
  errorForeground: '#ff0000',
  warningForeground: '#ffff00',
  infoForeground: '#00ffff',
  successForeground: '#00ff00',
  'terminal.background': '#000000',
  'terminal.foreground': '#ffffff',
  'terminalCursor.foreground': '#ffff00',
  'terminal.selectionBackground': '#f38518',
  'terminalAnsi.black': '#000000',
  'terminalAnsi.red': '#ff0000',
  'terminalAnsi.green': '#00ff00',
  'terminalAnsi.yellow': '#ffff00',
  'terminalAnsi.blue': '#00aaff',
  'terminalAnsi.magenta': '#ff00ff',
  'terminalAnsi.cyan': '#00ffff',
  'terminalAnsi.white': '#ffffff',
  'terminalAnsi.brightBlack': '#808080',
  'terminalAnsi.brightRed': '#ff6666',
  'terminalAnsi.brightGreen': '#66ff66',
  'terminalAnsi.brightYellow': '#ffff66',
  'terminalAnsi.brightBlue': '#66ccff',
  'terminalAnsi.brightMagenta': '#ff66ff',
  'terminalAnsi.brightCyan': '#66ffff',
  'terminalAnsi.brightWhite': '#ffffff'
};

export const DEFAULT_THEME_COLORS_BY_KIND: Record<ThemeKind, ThemeColorTokens> = {
  dark: BASE_DARK_COLORS,
  light: BASE_LIGHT_COLORS,
  'high-contrast': BASE_HIGH_CONTRAST_COLORS
};

export const DEFAULT_THEME_TYPOGRAPHY_TOKENS: ThemeTypographyTokens = {
  'font.family.ui': "'IBM Plex Sans', 'Segoe UI', sans-serif",
  'font.family.mono': "'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace",
  'font.size.xs': '11px',
  'font.size.sm': '12px',
  'font.size.md': '13px',
  'font.size.lg': '16px',
  'font.size.xl': '20px',
  'font.weight.regular': '400',
  'font.weight.medium': '500',
  'font.weight.semibold': '600',
  'font.lineHeight.tight': '1.25',
  'font.lineHeight.normal': '1.5',
  'font.lineHeight.relaxed': '1.75'
};

export const DEFAULT_THEME_SPACING_TOKENS: ThemeSpacingTokens = {
  'space.0': '0',
  'space.1': '2px',
  'space.2': '4px',
  'space.3': '6px',
  'space.4': '8px',
  'space.5': '12px',
  'space.6': '16px',
  'space.8': '20px',
  'space.10': '24px',
  'space.12': '32px',
  'radius.sm': '3px',
  'radius.md': '6px',
  'radius.lg': '10px',
  'focus.outlineWidth': '1px'
};

export const DEFAULT_THEME_ICON_TOKENS: ThemeIconTokens = {
  'icon.size.xs': '12px',
  'icon.size.sm': '14px',
  'icon.size.md': '16px',
  'icon.size.lg': '20px',
  'icon.size.xl': '24px'
};

export const DEFAULT_THEME_LAYOUT_TOKENS: ThemeLayoutTokens = {
  'activityBar.width': '56px',
  'statusBar.height': '26px',
  'tab.height': '34px',
  'sidebar.headerHeight': '32px',
  'panel.headerHeight': '32px',
  'control.height.sm': '24px',
  'control.height.md': '32px',
  'control.height.lg': '40px'
};

export function createDefaultThemeTokens(kind: ThemeKind): ThemeDesignTokens {
  return {
    colors: { ...DEFAULT_THEME_COLORS_BY_KIND[kind] },
    typography: { ...DEFAULT_THEME_TYPOGRAPHY_TOKENS },
    spacing: { ...DEFAULT_THEME_SPACING_TOKENS },
    icons: { ...DEFAULT_THEME_ICON_TOKENS },
    layout: { ...DEFAULT_THEME_LAYOUT_TOKENS }
  };
}

export function createDefaultThemeCssVariables(kind: ThemeKind) {
  return toCssVariables(createDefaultThemeTokens(kind));
}

export function toCssVariables(tokens: ThemeDesignTokens) {
  return {
    ...mapSectionToCssVariables(tokens.colors, THEME_CSS_VARIABLES_BY_SLOT),
    ...mapSectionToCssVariables(tokens.typography, THEME_TYPOGRAPHY_CSS_VARIABLES_BY_SLOT),
    ...mapSectionToCssVariables(tokens.spacing, THEME_SPACING_CSS_VARIABLES_BY_SLOT),
    ...mapSectionToCssVariables(tokens.icons, THEME_ICON_CSS_VARIABLES_BY_SLOT),
    ...mapSectionToCssVariables(tokens.layout, THEME_LAYOUT_CSS_VARIABLES_BY_SLOT)
  };
}

export function isThemeColorSlot(slot: string): slot is ThemeColorSlot {
  return THEME_COLOR_SLOTS.includes(slot as ThemeColorSlot);
}

export function isThemeTypographySlot(slot: string): slot is ThemeTypographySlot {
  return THEME_TYPOGRAPHY_SLOTS.includes(slot as ThemeTypographySlot);
}

export function isThemeSpacingSlot(slot: string): slot is ThemeSpacingSlot {
  return THEME_SPACING_SLOTS.includes(slot as ThemeSpacingSlot);
}

export function isThemeIconSlot(slot: string): slot is ThemeIconSlot {
  return THEME_ICON_SLOTS.includes(slot as ThemeIconSlot);
}

export function isThemeLayoutSlot(slot: string): slot is ThemeLayoutSlot {
  return THEME_LAYOUT_SLOTS.includes(slot as ThemeLayoutSlot);
}

export function isValidThemeColorValue(value: string) {
  return CSS_COLOR_PATTERN.test(value);
}

export function isValidThemeTypographyValue(slot: ThemeTypographySlot, value: string) {
  if (slot.startsWith('font.family.')) {
    return value.trim().length > 0;
  }
  if (slot.startsWith('font.weight.')) {
    return FONT_WEIGHT_PATTERN.test(value);
  }
  if (slot.startsWith('font.lineHeight.')) {
    return CSS_LINE_HEIGHT_PATTERN.test(value);
  }
  return CSS_LENGTH_PATTERN.test(value);
}

export function isValidThemeSpacingValue(value: string) {
  return CSS_LENGTH_PATTERN.test(value);
}

export function isValidThemeIconValue(value: string) {
  return CSS_LENGTH_PATTERN.test(value);
}

export function isValidThemeLayoutValue(value: string) {
  return CSS_LENGTH_PATTERN.test(value);
}

function buildCssVariableMap<TSlot extends string>(slots: readonly TSlot[], overrides: Partial<Record<TSlot, string>> = {}) {
  return slots.reduce<Record<TSlot, string>>((variables, slot) => {
    variables[slot] = overrides[slot] ?? `--nexus-${toKebabIdentifier(slot)}`;
    return variables;
  }, {} as Record<TSlot, string>);
}

function mapSectionToCssVariables<TSlot extends string>(
  values: Record<TSlot, string>,
  cssVariablesBySlot: Record<TSlot, string>
) {
  return Object.entries(values).reduce<Record<string, string>>((variables, [slot, value]) => {
    variables[cssVariablesBySlot[slot as TSlot]] = String(value);
    return variables;
  }, {});
}

function toKebabIdentifier(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[.\s]+/g, '-')
    .toLowerCase();
}
