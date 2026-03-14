import { BUILTIN_FILE_ICON_THEME } from './file-icon-mappings';
import {
  FileIconResolution,
  FileIconResolutionReason,
  FileIconRequest,
  FileIconResolverOptions,
  FileIconTheme
} from './file-icon-types';

const DEFAULT_CACHE_SIZE = 1024;

export class FileIconResolver {
  private readonly theme: FileIconTheme;
  private readonly caseSensitive: boolean;
  private readonly cache = new Map<string, FileIconResolution>();
  private readonly cacheSize: number;
  private readonly fileNameMap: Map<string, string>;
  private readonly fileExtensionMap: Map<string, string>;
  private readonly fileCompoundMap: Map<string, string>;
  private readonly fileCompoundKeys: string[];
  private readonly fileLanguageMap: Map<string, string>;
  private readonly folderNameMap: Map<string, { collapsed: string; expanded?: string }>;

  constructor(options: FileIconResolverOptions = { theme: BUILTIN_FILE_ICON_THEME }) {
    this.theme = options.theme;
    this.caseSensitive = options.caseSensitive ?? false;
    this.cacheSize = options.cacheSize ?? DEFAULT_CACHE_SIZE;
    this.fileNameMap = this.normalizeRecord(this.theme.files.byFileName);
    this.fileExtensionMap = this.normalizeRecord(this.theme.files.byExtension);
    this.fileCompoundMap = this.normalizeRecord(this.theme.files.byCompoundExtension);
    this.fileCompoundKeys = Array.from(this.fileCompoundMap.keys()).sort((a, b) => b.length - a.length);
    this.fileLanguageMap = this.normalizeRecord(this.theme.files.byLanguageId);
    this.folderNameMap = new Map();
    const folderRecord = this.theme.folders.byName ?? {};
    Object.entries(folderRecord).forEach(([key, value]) => {
      this.folderNameMap.set(this.normalizeKey(key), value);
    });
  }

  resolve(request: FileIconRequest): FileIconResolution {
    if (!request.fileName) {
      throw new Error('fileName is required to resolve icon');
    }
    const cacheKey = this.cacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const resolution = request.isFolder ? this.resolveFolder(request) : this.resolveFile(request);
    this.memoize(cacheKey, resolution);
    return resolution;
  }

  private resolveFolder(request: FileIconRequest): FileIconResolution {
    const nameKey = this.normalizeKey(basename(request.fileName));
    if (request.isRootFolder) {
      const iconId = request.isFolderExpanded
        ? this.theme.folders.rootExpanded ?? this.theme.folders.expanded
        : this.theme.folders.root ?? this.theme.folders.default;
      return { iconId, reason: 'folder-root' };
    }

    const folderVariant = this.folderNameMap.get(nameKey);
    if (folderVariant) {
      const iconId = request.isFolderExpanded
        ? folderVariant.expanded ?? folderVariant.collapsed
        : folderVariant.collapsed;
      return { iconId, reason: 'folder-name' };
    }

    const iconId = request.isFolderExpanded ? this.theme.folders.expanded : this.theme.folders.default;
    return { iconId, reason: 'folder-default' };
  }

  private resolveFile(request: FileIconRequest): FileIconResolution {
    const fileName = basename(request.fileName);
    const nameKey = this.normalizeKey(fileName);

    const byName = this.fileNameMap.get(nameKey);
    if (byName) {
      return { iconId: byName, reason: 'file-name' };
    }

    const compoundIcon = this.resolveCompoundExtension(nameKey);
    if (compoundIcon) {
      return { iconId: compoundIcon, reason: 'file-compound-extension' };
    }

    const ext = this.extractExtension(fileName);
    if (ext) {
      const byExt = this.fileExtensionMap.get(ext);
      if (byExt) {
        return { iconId: byExt, reason: 'file-extension' };
      }
    }

    if (request.languageId) {
      const langIcon = this.fileLanguageMap.get(this.normalizeKey(request.languageId));
      if (langIcon) {
        return { iconId: langIcon, reason: 'file-language' };
      }
    }

    return { iconId: this.theme.files.default, reason: 'file-default' };
  }

  private resolveCompoundExtension(nameKey: string): string | undefined {
    for (const compound of this.fileCompoundKeys) {
      if (nameKey.endsWith(compound)) {
        return this.fileCompoundMap.get(compound);
      }
      if (nameKey.endsWith(`.${compound}`)) {
        return this.fileCompoundMap.get(compound);
      }
    }
    return undefined;
  }

  private extractExtension(fileName: string): string | undefined {
    const base = basename(fileName);
    const parts = base.split('.');
    if (parts.length <= 1) {
      return undefined;
    }
    const extension = parts.pop() ?? '';
    if (!extension) {
      return undefined;
    }
    return this.normalizeKey(extension);
  }

  private cacheKey(request: FileIconRequest): string {
    const parts = [
      request.isFolder ? 'folder' : 'file',
      this.normalizeKey(basename(request.fileName)),
      request.isFolderExpanded ? '1' : '0',
      request.isRootFolder ? '1' : '0',
      request.languageId ? this.normalizeKey(request.languageId) : ''
    ];
    return parts.join('|');
  }

  private memoize(key: string, value: FileIconResolution) {
    if (this.cache.size >= this.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  private normalizeRecord(record?: Record<string, string>): Map<string, string> {
    const map = new Map<string, string>();
    if (!record) {
      return map;
    }
    Object.entries(record).forEach(([rawKey, value]) => {
      map.set(this.normalizeKey(rawKey), value);
    });
    return map;
  }

  private normalizeKey(value: string): string {
    return this.caseSensitive ? value : value.toLowerCase();
  }
}

function basename(target: string): string {
  const segments = target.split(/[/\\]/);
  return segments[segments.length - 1] || target;
}
