import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type { NexusEnv } from '@nexus/platform/env';
import { log, logError } from './logger';

export type KeybindingMap = Record<string, string>;

const DEFAULT_KEYMAP: KeybindingMap = {
  'nexus.window.new': 'CmdOrCtrl+Shift+N',
  'nexus.window.close': 'CmdOrCtrl+W',
  'nexus.workspace.open': 'CmdOrCtrl+O',
  'nexus.window.reload': 'CmdOrCtrl+R',
  'nexus.window.toggleDevtools': 'Alt+CmdOrCtrl+I',
  'nexus.view.toggleFullScreen': process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
  'nexus.zoom.in': 'CmdOrCtrl+=',
  'nexus.zoom.out': 'CmdOrCtrl+-',
  'nexus.zoom.reset': 'CmdOrCtrl+0',
  'nexus.help.toggleDocs': 'CmdOrCtrl+/'
};

const KEYMAP_FILENAME = 'keymaps.json';

export class KeymapService extends EventEmitter {
  private readonly storageDir: string;
  private readonly keymapPath: string;
  private keymap: KeybindingMap = { ...DEFAULT_KEYMAP };
  private watcher?: fs.FSWatcher;

  constructor(private readonly env: NexusEnv) {
    super();
    this.storageDir = this.resolveBaseDir(env.nexusHome);
    this.keymapPath = path.join(this.storageDir, KEYMAP_FILENAME);
  }

  initialize() {
    this.ensureStorageDir();
    this.loadFromDisk();
    this.watch();
  }

  dispose() {
    this.watcher?.close();
  }

  getAccelerator(commandId: string, fallback?: string) {
    return this.keymap[commandId] ?? fallback;
  }

  getSnapshot(): KeybindingMap {
    return { ...this.keymap };
  }

  private ensureStorageDir() {
    fs.mkdirSync(this.storageDir, { recursive: true });
  }

  private loadFromDisk() {
    if (!fs.existsSync(this.keymapPath)) {
      this.writeDefaultFile();
      return;
    }
    try {
      const raw = fs.readFileSync(this.keymapPath, 'utf8');
      const parsed = JSON.parse(raw) as KeybindingMap;
      if (parsed && typeof parsed === 'object') {
        this.keymap = { ...DEFAULT_KEYMAP, ...parsed };
        this.emit('changed', this.getSnapshot());
      }
    } catch (error) {
      logError('Failed to load keymap, falling back to defaults', error);
      this.keymap = { ...DEFAULT_KEYMAP };
      this.writeDefaultFile();
    }
  }

  private writeDefaultFile() {
    try {
      fs.writeFileSync(this.keymapPath, JSON.stringify(DEFAULT_KEYMAP, null, 2), 'utf8');
      this.keymap = { ...DEFAULT_KEYMAP };
      log(`Created default keymap at ${this.keymapPath}`);
      this.emit('changed', this.getSnapshot());
    } catch (error) {
      logError('Failed to write default keymap', error);
    }
  }

  private watch() {
    this.watcher?.close();
    try {
      this.watcher = fs.watch(this.keymapPath, { persistent: false }, () => {
        this.debounceReload();
      });
    } catch (error) {
      logError('Unable to watch keymap file', error);
    }
  }

  private debounceReloadTimeout?: NodeJS.Timeout;

  private debounceReload() {
    if (this.debounceReloadTimeout) {
      clearTimeout(this.debounceReloadTimeout);
    }
    this.debounceReloadTimeout = setTimeout(() => {
      this.loadFromDisk();
    }, 150);
  }

  private resolveBaseDir(dir: string) {
    if (!dir) return path.resolve(process.cwd(), '.nexus');
    return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
  }
}
