export interface FolderIconSet {
  readonly default: string;
  readonly expanded: string;
  readonly root?: string;
  readonly rootExpanded?: string;
  readonly byName?: Record<string, FolderIconVariant>;
}

export interface FolderIconVariant {
  readonly collapsed: string;
  readonly expanded?: string;
}

export interface FileIconSet {
  readonly default: string;
  readonly byFileName?: Record<string, string>;
  readonly byLanguageId?: Record<string, string>;
  readonly byExtension?: Record<string, string>;
  readonly byCompoundExtension?: Record<string, string>;
}

export interface FileIconTheme {
  readonly folders: FolderIconSet;
  readonly files: FileIconSet;
}

export interface FileIconResolverOptions {
  readonly theme: FileIconTheme;
  readonly caseSensitive?: boolean;
  readonly cacheSize?: number;
}

export interface FileIconRequest {
  readonly fileName: string;
  readonly languageId?: string;
  readonly isFolder?: boolean;
  readonly isFolderExpanded?: boolean;
  readonly isRootFolder?: boolean;
}

export interface FileIconResolution {
  readonly iconId: string;
  readonly reason: FileIconResolutionReason;
}

export type FileIconResolutionReason =
  | 'folder-name'
  | 'folder-default'
  | 'folder-root'
  | 'file-name'
  | 'file-compound-extension'
  | 'file-extension'
  | 'file-language'
  | 'file-default';
