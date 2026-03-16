import { BUILTIN_FILE_ICON_THEME } from './file-icon-mappings';
import type { FolderIconVariant, FileIconTheme } from './file-icon-types';
import type { IconDefinition, IconKind } from './icon-types';
import { IconRegistry } from './icon-registry';

function createCodiconDefinition(
  id: string,
  label: string,
  codiconName: string,
  aliases?: readonly string[]
): IconDefinition {
  return {
    id,
    version: 1,
    label,
    kind: 'codicon',
    aliases,
    variants: {
      light: { cssClasses: ['codicon', `codicon-${codiconName}`], source: 'font' },
      dark: { cssClasses: ['codicon', `codicon-${codiconName}`], source: 'font' },
      highContrast: { cssClasses: ['codicon', `codicon-${codiconName}`], source: 'font' }
    }
  };
}

function createAssetDefinition(
  id: string,
  label: string,
  kind: IconKind,
  assetClass: string
): IconDefinition {
  const baseClass = kind === 'folder-icon' ? 'nexus-folder-icon' : 'nexus-file-icon';

  return {
    id,
    version: 1,
    label,
    kind,
    variants: {
      light: { cssClasses: ['nexus-icon', baseClass, assetClass], source: 'custom-class' },
      dark: { cssClasses: ['nexus-icon', baseClass, assetClass], source: 'custom-class' },
      highContrast: { cssClasses: ['nexus-icon', baseClass, assetClass], source: 'custom-class' }
    }
  };
}

function toAssetClass(id: string) {
  return `nexus-icon-${id.replace(/^icon\./, '').replace(/\./g, '-')}`;
}

function titleCase(value: string) {
  return value
    .split(/[-.]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function collectFolderIcons(theme: FileIconTheme) {
  const results = new Set<string>([
    theme.folders.default,
    theme.folders.expanded,
    theme.folders.root ?? theme.folders.default,
    theme.folders.rootExpanded ?? theme.folders.expanded
  ]);

  Object.values(theme.folders.byName ?? {}).forEach((variant: FolderIconVariant) => {
    results.add(variant.collapsed);
    if (variant.expanded) {
      results.add(variant.expanded);
    }
  });

  return Array.from(results).sort();
}

function collectFileIcons(theme: FileIconTheme) {
  const results = new Set<string>([theme.files.default]);

  [theme.files.byFileName, theme.files.byLanguageId, theme.files.byExtension, theme.files.byCompoundExtension].forEach(record => {
    Object.values(record ?? {}).forEach(iconId => results.add(iconId));
  });

  return Array.from(results).sort();
}

export const BUILTIN_CODICON_ICON_DEFINITIONS: readonly IconDefinition[] = Object.freeze([
  createCodiconDefinition('icon.fallback', 'Fallback icon', 'question'),
  createCodiconDefinition('icon.codicon.file', 'Generic file', 'file'),
  createCodiconDefinition('icon.codicon.folder', 'Generic folder', 'folder'),
  createCodiconDefinition('icon.codicon.folder-open', 'Open folder', 'folder-opened'),
  createCodiconDefinition('icon.codicon.search', 'Search', 'search'),
  createCodiconDefinition('icon.codicon.settings', 'Settings', 'settings-gear'),
  createCodiconDefinition('icon.codicon.terminal', 'Terminal', 'terminal'),
  createCodiconDefinition('icon.codicon.run', 'Run', 'play'),
  createCodiconDefinition('icon.codicon.debug', 'Debug', 'debug-alt'),
  createCodiconDefinition('icon.codicon.ai', 'AI', 'sparkle')
]);

export const BUILTIN_FILE_FOLDER_ICON_DEFINITIONS: readonly IconDefinition[] = Object.freeze([
  ...collectFolderIcons(BUILTIN_FILE_ICON_THEME).map(iconId =>
    createAssetDefinition(
      iconId,
      titleCase(iconId.replace(/^icon\.folder\./, '').replace(/\.open$/, ' open')),
      'folder-icon',
      toAssetClass(iconId)
    )
  ),
  ...collectFileIcons(BUILTIN_FILE_ICON_THEME).map(iconId =>
    createAssetDefinition(
      iconId,
      titleCase(iconId.replace(/^icon\.file\./, '')),
      'file-icon',
      toAssetClass(iconId)
    )
  )
]);

export const BUILTIN_ICON_PACK_DEFINITIONS: readonly IconDefinition[] = Object.freeze([
  ...BUILTIN_CODICON_ICON_DEFINITIONS,
  ...BUILTIN_FILE_FOLDER_ICON_DEFINITIONS
]);

export function registerBuiltinIconPack(
  registry: Pick<IconRegistry, 'registerIcons' | 'hasIcon'>,
  options: { allowOverride?: boolean } = {}
) {
  const definitions = BUILTIN_ICON_PACK_DEFINITIONS.filter(definition => options.allowOverride || !registry.hasIcon(definition.id));
  if (definitions.length > 0) {
    registry.registerIcons(definitions, { allowOverride: options.allowOverride });
  }
  return definitions;
}
