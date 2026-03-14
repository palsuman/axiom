import { BUILTIN_FILE_ICON_THEME } from './file-icon-mappings';
import { FileIconResolver } from './file-icon-resolver';

const resolver = new FileIconResolver({ theme: BUILTIN_FILE_ICON_THEME });

describe('FileIconResolver - folders', () => {
  it('resolves named folders with expanded vs collapsed state', () => {
    const collapsed = resolver.resolve({ fileName: 'src', isFolder: true });
    const expanded = resolver.resolve({ fileName: 'src', isFolder: true, isFolderExpanded: true });

    expect(collapsed).toEqual({ iconId: 'icon.folder.src', reason: 'folder-name' });
    expect(expanded).toEqual({ iconId: 'icon.folder.src.open', reason: 'folder-name' });
  });

  it('uses root icons when flagged as root folder', () => {
    const collapsed = resolver.resolve({ fileName: 'workspace', isFolder: true, isRootFolder: true });
    const expanded = resolver.resolve({ fileName: 'workspace', isFolder: true, isRootFolder: true, isFolderExpanded: true });

    expect(collapsed.iconId).toBe('icon.folder.root');
    expect(collapsed.reason).toBe('folder-root');
    expect(expanded.iconId).toBe('icon.folder.root.open');
  });
});

describe('FileIconResolver - files', () => {
  it('prefers exact filename before extensions', () => {
    const result = resolver.resolve({ fileName: '/repo/app/package.json' });
    expect(result).toEqual({ iconId: 'icon.file.package-json', reason: 'file-name' });
  });

  it('falls back to compound extension before single extension', () => {
    const compound = resolver.resolve({ fileName: 'app.component.spec.ts' });
    expect(compound).toEqual({ iconId: 'icon.file.typescript-spec', reason: 'file-compound-extension' });
  });

  it('uses language id when extension mapping is missing', () => {
    const custom = new FileIconResolver({
      theme: {
        folders: BUILTIN_FILE_ICON_THEME.folders,
        files: {
          default: 'icon.file.default',
          byLanguageId: { prisma: 'icon.file.prisma' }
        }
      }
    });

    const result = custom.resolve({ fileName: 'schema', languageId: 'prisma' });
    expect(result).toEqual({ iconId: 'icon.file.prisma', reason: 'file-language' });
  });

  it('falls back to default icon when no mappings match', () => {
    const result = resolver.resolve({ fileName: 'notes.unknownext' });
    expect(result).toEqual({ iconId: 'icon.file.default', reason: 'file-default' });
  });
});
