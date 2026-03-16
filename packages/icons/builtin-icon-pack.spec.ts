import { BUILTIN_FILE_ICON_THEME } from './file-icon-mappings';
import {
  BUILTIN_CODICON_ICON_DEFINITIONS,
  BUILTIN_FILE_FOLDER_ICON_DEFINITIONS,
  BUILTIN_ICON_PACK_DEFINITIONS,
  registerBuiltinIconPack
} from './builtin-icon-pack';
import { IconRegistry } from './icon-registry';

describe('builtin icon pack', () => {
  it('ships the codicon fallback and curated codicon entries', () => {
    const ids = BUILTIN_CODICON_ICON_DEFINITIONS.map(definition => definition.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        'icon.fallback',
        'icon.codicon.file',
        'icon.codicon.folder',
        'icon.codicon.folder-open',
        'icon.codicon.terminal'
      ])
    );
  });

  it('covers every built-in file and folder icon id referenced by the resolver theme', () => {
    const registeredIds = new Set(BUILTIN_FILE_FOLDER_ICON_DEFINITIONS.map(definition => definition.id));

    const expectedFileIds = new Set<string>([BUILTIN_FILE_ICON_THEME.files.default]);
    [BUILTIN_FILE_ICON_THEME.files.byFileName, BUILTIN_FILE_ICON_THEME.files.byLanguageId, BUILTIN_FILE_ICON_THEME.files.byExtension, BUILTIN_FILE_ICON_THEME.files.byCompoundExtension].forEach(
      record => Object.values(record ?? {}).forEach(id => expectedFileIds.add(id))
    );

    const expectedFolderIds = new Set<string>([
      BUILTIN_FILE_ICON_THEME.folders.default,
      BUILTIN_FILE_ICON_THEME.folders.expanded,
      BUILTIN_FILE_ICON_THEME.folders.root ?? BUILTIN_FILE_ICON_THEME.folders.default,
      BUILTIN_FILE_ICON_THEME.folders.rootExpanded ?? BUILTIN_FILE_ICON_THEME.folders.expanded
    ]);
    Object.values(BUILTIN_FILE_ICON_THEME.folders.byName ?? {}).forEach(variant => {
      expectedFolderIds.add(variant.collapsed);
      if (variant.expanded) {
        expectedFolderIds.add(variant.expanded);
      }
    });

    [...expectedFileIds, ...expectedFolderIds].forEach(iconId => {
      expect(registeredIds.has(iconId)).toBe(true);
    });
  });

  it('registers the full built-in pack into the icon registry', () => {
    const registry = new IconRegistry();

    registerBuiltinIconPack(registry, { allowOverride: true });

    expect(registry.listIconIds()).toEqual(expect.arrayContaining(BUILTIN_ICON_PACK_DEFINITIONS.map(definition => definition.id)));
    expect(registry.resolveIcon('icon.file.typescript').variant.cssClasses).toContain('nexus-icon-file-typescript');
    expect(registry.resolveIcon('icon.codicon.search').variant.cssClasses).toContain('codicon-search');
  });
});
