import fs from 'node:fs';
import path from 'node:path';
import chokidar, { FSWatcher } from 'chokidar';
import ignore from 'ignore';

export type WorkspaceWatchEventType = 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir';

export interface WorkspaceWatchEvent {
  readonly type: WorkspaceWatchEventType;
  readonly root: string;
  readonly absolutePath: string;
  readonly relativePath: string;
}

export interface WorkspaceWatcherOptions {
  readonly roots: readonly string[];
  readonly additionalIgnorePatterns?: readonly string[];
  readonly respectGitIgnore?: boolean;
  readonly respectNexusIgnore?: boolean;
}

export interface WatcherFactoryOptions {
  readonly root: string;
  readonly ignored: (testPath: string) => boolean;
}

export interface WatcherAdapter {
  on(event: 'all', handler: (event: WorkspaceWatchEventType, filePath: string) => void): WatcherAdapter;
  on(event: 'ready', handler: () => void): WatcherAdapter;
  on(event: 'error', handler: (error: Error) => void): WatcherAdapter;
  close(): Promise<void>;
}

export type WatcherFactory = (options: WatcherFactoryOptions) => WatcherAdapter;

const DEFAULT_IGNORE = ['.git', '.nexus', 'node_modules', '.idea', '.vs', '.DS_Store'];
const EMITTED_EVENTS: readonly WorkspaceWatchEventType[] = ['add', 'addDir', 'change', 'unlink', 'unlinkDir'];

export const chokidarWatcherFactory: WatcherFactory = ({ root, ignored }) =>
  chokidar.watch(root, {
    persistent: true,
    ignoreInitial: true,
    ignored,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
    depth: undefined,
    followSymlinks: false,
    ignorePermissionErrors: true
  }) as WFAdapter;

type WFAdapter = FSWatcher & WatcherAdapter;

export class WorkspaceWatcher {
  private readonly watcherFactory: WatcherFactory;
  private readonly options: WorkspaceWatcherOptions;
  private readonly watchers: WatcherAdapter[] = [];
  private readonly eventListeners = new Set<(evt: WorkspaceWatchEvent) => void>();
  private readonly readyListeners = new Set<() => void>();
  private readonly errorListeners = new Set<(error: Error) => void>();
  private readyCount = 0;
  private disposed = false;

  constructor(options: WorkspaceWatcherOptions, watcherFactory: WatcherFactory = chokidarWatcherFactory) {
    if (!options.roots?.length) {
      throw new Error('WorkspaceWatcher requires at least one root directory.');
    }
    this.options = {
      respectGitIgnore: true,
      respectNexusIgnore: true,
      ...options,
      roots: dedupeRoots(options.roots)
    };
    this.watcherFactory = watcherFactory;
    this.bootstrap();
  }

  onEvent(listener: (event: WorkspaceWatchEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onReady(listener: () => void): () => void {
    this.readyListeners.add(listener);
    return () => this.readyListeners.delete(listener);
  }

  onError(listener: (error: Error) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await Promise.allSettled(this.watchers.map(watcher => watcher.close()));
    this.watchers.length = 0;
  }

  private bootstrap() {
    this.options.roots.forEach(root => {
      const matcher = buildIgnoreMatcher(root, {
        additionalPatterns: this.options.additionalIgnorePatterns,
        respectGitIgnore: this.options.respectGitIgnore !== false,
        respectNexusIgnore: this.options.respectNexusIgnore !== false
      });
      const watcher = this.watcherFactory({ root, ignored: matcher });
      this.attachWatcher(watcher, root);
      this.watchers.push(watcher);
    });
  }

  private attachWatcher(watcher: WatcherAdapter, root: string) {
    watcher
      .on('all', (event, filePath) => {
        if (!EMITTED_EVENTS.includes(event)) {
          return;
        }
        const normalized = normalizePath(filePath, root);
        const relative = path.relative(root, normalized.absolutePath);
        this.emitEvent({
          type: event,
          root,
          absolutePath: normalized.absolutePath,
          relativePath: relative
        });
      })
      .on('ready', () => {
        this.readyCount += 1;
        if (this.readyCount === this.watchers.length) {
          this.readyListeners.forEach(listener => listener());
        }
      })
      .on('error', error => this.errorListeners.forEach(listener => listener(error)));
  }

  private emitEvent(event: WorkspaceWatchEvent) {
    this.eventListeners.forEach(listener => listener(event));
  }
}

export function buildIgnoreMatcher(
  root: string,
  options: {
    additionalPatterns?: readonly string[];
    respectGitIgnore?: boolean;
    respectNexusIgnore?: boolean;
  } = {}
): (testPath: string) => boolean {
  const ig = ignore();
  ig.add(DEFAULT_IGNORE.map(pattern => ensureTrailingGlob(pattern)));
  if (options.additionalPatterns?.length) {
    ig.add(options.additionalPatterns.map(pattern => pattern.trim()).filter(Boolean));
  }
  if (options.respectGitIgnore !== false) {
    ig.add(readIgnoreFile(root, '.gitignore'));
  }
  if (options.respectNexusIgnore !== false) {
    ig.add(readIgnoreFile(root, '.nexusignore'));
  }
  return (testPath: string) => {
    const abs = path.isAbsolute(testPath) ? testPath : path.join(root, testPath);
    const relative = path.relative(root, abs);
    if (!relative || relative.startsWith('..')) {
      return false;
    }
    const normalized = toPosix(relative);
    return ig.ignores(normalized);
  };
}

function readIgnoreFile(root: string, fileName: string): string[] {
  const filePath = path.join(root, fileName);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return raw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => !!line && !line.startsWith('#'));
  } catch (error) {
    return [];
  }
}

function ensureTrailingGlob(pattern: string) {
  if (pattern.endsWith('/**')) return pattern;
  if (pattern.endsWith('/')) return `${pattern}**`;
  if (pattern.includes('/')) return `${pattern}/**`;
  return pattern;
}

function normalizePath(filePath: string, root: string) {
  const absolutePath = path.isAbsolute(filePath) ? path.normalize(filePath) : path.normalize(path.join(root, filePath));
  return { absolutePath };
}

function toPosix(relativePath: string) {
  return relativePath.split(path.sep).join('/');
}

function dedupeRoots(roots: readonly string[]) {
  const set = new Set<string>();
  roots.forEach(root => set.add(path.resolve(root)));
  return Array.from(set);
}
