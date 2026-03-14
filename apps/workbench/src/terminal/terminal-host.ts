import { TerminalClient } from './terminal-client';
import type { TerminalDescriptor, WorkspaceBackupTerminal } from '@nexus/contracts/ipc';
import { TerminalSnapshotBuffer } from './terminal-snapshot-buffer';
import { toTerminalThemeDefinition, type ThemeRuntime } from '@nexus/platform/theming/theme-runtime';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

type TerminalHostOptions = {
  container?: HTMLElement;
  theme?: {
    background?: string;
    foreground?: string;
    cursor?: string;
    selectionBackground?: string;
    black?: string;
    red?: string;
    green?: string;
    yellow?: string;
    blue?: string;
    magenta?: string;
    cyan?: string;
    white?: string;
    brightBlack?: string;
    brightRed?: string;
    brightGreen?: string;
    brightYellow?: string;
    brightBlue?: string;
    brightMagenta?: string;
    brightCyan?: string;
    brightWhite?: string;
    fontFamily?: string;
    fontSize?: number;
    lineHeight?: number;
  };
  bufferLimit?: number;
};

type TerminalThemeOptions = NonNullable<TerminalHostOptions['theme']>;

export class TerminalHost {
  private readonly client: TerminalClient;
  private readonly term: Terminal;
  private readonly fitAddon: FitAddon;
  private readonly snapshotBuffer: TerminalSnapshotBuffer;
  private readonly bufferListeners = new Set<() => void>();
  private descriptor?: TerminalDescriptor;
  private disposeData?: () => void;
  private disposeExit?: () => void;
  private resizeObserver?: ResizeObserver;
  private container?: HTMLElement;
  private pendingReplay?: WorkspaceBackupTerminal;
  private currentTheme: TerminalThemeOptions;
  private disposeThemeRuntime?: () => void;

  constructor(options: TerminalHostOptions = {}, client = new TerminalClient()) {
    this.client = client;
    this.snapshotBuffer = new TerminalSnapshotBuffer(options.bufferLimit);
    this.currentTheme = {
      background: options.theme?.background ?? '#1e1e1e',
      foreground: options.theme?.foreground ?? '#ffffff',
      cursor: options.theme?.cursor,
      selectionBackground: options.theme?.selectionBackground,
      black: options.theme?.black,
      red: options.theme?.red,
      green: options.theme?.green,
      yellow: options.theme?.yellow,
      blue: options.theme?.blue,
      magenta: options.theme?.magenta,
      cyan: options.theme?.cyan,
      white: options.theme?.white,
      brightBlack: options.theme?.brightBlack,
      brightRed: options.theme?.brightRed,
      brightGreen: options.theme?.brightGreen,
      brightYellow: options.theme?.brightYellow,
      brightBlue: options.theme?.brightBlue,
      brightMagenta: options.theme?.brightMagenta,
      brightCyan: options.theme?.brightCyan,
      brightWhite: options.theme?.brightWhite,
      fontFamily: options.theme?.fontFamily,
      fontSize: options.theme?.fontSize,
      lineHeight: options.theme?.lineHeight
    };
    this.term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      theme: { ...this.currentTheme }
    });
    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
    if (options.container) {
      this.attach(options.container).catch(error => {
        console.error('[terminal] failed to attach', error);
      });
    }
  }

  async attach(container: HTMLElement) {
    if (typeof document === 'undefined') {
      return;
    }
    this.container = container;
    container.classList.add('nexus-terminal-host');
    this.injectBaseStyles();
    this.term.open(container);
    this.applyTheme(this.currentTheme);
    this.fitAddon.fit();
    const cols = this.term.cols;
    const rows = this.term.rows;
    this.descriptor = await this.client.create({ cols, rows });
    this.disposeData = this.client.onData(event => {
      if (event.terminalId === this.descriptor?.terminalId) {
        this.handleIncomingData(event.data);
      }
    });
    this.disposeExit = this.client.onExit(event => {
      if (event.terminalId === this.descriptor?.terminalId) {
        this.term.writeln(`\r\n[process exited with code ${event.code}]`);
      }
    });
    this.term.onData(data => {
      if (!this.descriptor) return;
      this.client.write({ terminalId: this.descriptor.terminalId, data });
    });
    window.addEventListener('resize', this.handleResize);
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(container);
    }
    this.replayPendingSnapshot();
  }

  captureSnapshot(): WorkspaceBackupTerminal | null {
    if (!this.descriptor && this.snapshotBuffer.isEmpty()) {
      return null;
    }
    return {
      terminalId: this.descriptor?.terminalId ?? 'pending',
      shell: this.descriptor?.shell,
      cwd: this.descriptor?.cwd,
      buffer: this.snapshotBuffer.toString(),
      cols: this.term.cols,
      rows: this.term.rows,
      lastUpdatedAt: Date.now()
    };
  }

  restoreFromSnapshot(snapshot: WorkspaceBackupTerminal) {
    this.pendingReplay = snapshot;
    if (snapshot.buffer) {
      this.snapshotBuffer.reset(snapshot.buffer);
    }
    this.replayPendingSnapshot();
  }

  onBufferChange(listener: () => void) {
    this.bufferListeners.add(listener);
    return () => this.bufferListeners.delete(listener);
  }

  updateTheme(theme: TerminalThemeOptions) {
    this.currentTheme = {
      background: theme.background ?? this.currentTheme.background,
      foreground: theme.foreground ?? this.currentTheme.foreground,
      cursor: theme.cursor ?? this.currentTheme.cursor,
      selectionBackground: theme.selectionBackground ?? this.currentTheme.selectionBackground,
      black: theme.black ?? this.currentTheme.black,
      red: theme.red ?? this.currentTheme.red,
      green: theme.green ?? this.currentTheme.green,
      yellow: theme.yellow ?? this.currentTheme.yellow,
      blue: theme.blue ?? this.currentTheme.blue,
      magenta: theme.magenta ?? this.currentTheme.magenta,
      cyan: theme.cyan ?? this.currentTheme.cyan,
      white: theme.white ?? this.currentTheme.white,
      brightBlack: theme.brightBlack ?? this.currentTheme.brightBlack,
      brightRed: theme.brightRed ?? this.currentTheme.brightRed,
      brightGreen: theme.brightGreen ?? this.currentTheme.brightGreen,
      brightYellow: theme.brightYellow ?? this.currentTheme.brightYellow,
      brightBlue: theme.brightBlue ?? this.currentTheme.brightBlue,
      brightMagenta: theme.brightMagenta ?? this.currentTheme.brightMagenta,
      brightCyan: theme.brightCyan ?? this.currentTheme.brightCyan,
      brightWhite: theme.brightWhite ?? this.currentTheme.brightWhite,
      fontFamily: theme.fontFamily ?? this.currentTheme.fontFamily,
      fontSize: theme.fontSize ?? this.currentTheme.fontSize,
      lineHeight: theme.lineHeight ?? this.currentTheme.lineHeight
    };
    this.applyTheme(this.currentTheme);
  }

  bindThemeRuntime(themeRuntime: Pick<ThemeRuntime, 'getSnapshot' | 'onDidChange'>) {
    this.disposeThemeRuntime?.();
    const applySnapshot = () => {
      this.updateTheme(toTerminalThemeDefinition(themeRuntime.getSnapshot()));
    };
    applySnapshot();
    this.disposeThemeRuntime = themeRuntime.onDidChange(() => {
      applySnapshot();
    });
    return () => {
      this.disposeThemeRuntime?.();
      this.disposeThemeRuntime = undefined;
    };
  }

  dispose() {
    this.disposeThemeRuntime?.();
    this.disposeThemeRuntime = undefined;
    this.disposeData?.();
    this.disposeExit?.();
    this.resizeObserver?.disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleResize);
    }
    if (this.descriptor) {
      this.client.dispose({ terminalId: this.descriptor.terminalId }).catch(() => undefined);
    }
    this.term.dispose();
    this.container?.remove();
  }

  private handleResize = () => {
    if (!this.descriptor) return;
    this.fitAddon.fit();
    this.client.resize({
      terminalId: this.descriptor.terminalId,
      cols: this.term.cols,
      rows: this.term.rows
    });
  };

  private handleIncomingData(data: string) {
    this.term.write(data);
    this.snapshotBuffer.append(data);
    this.bufferListeners.forEach(listener => listener());
  }

  private replayPendingSnapshot() {
    if (!this.pendingReplay || !this.term) return;
    const buffer = this.pendingReplay.buffer;
    if (buffer) {
      this.term.write(buffer);
    }
    this.pendingReplay = undefined;
  }

  private injectBaseStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('nexus-terminal-styles')) return;
    const style = document.createElement('style');
    style.id = 'nexus-terminal-styles';
    style.textContent = `
      .nexus-terminal-host {
        position: relative;
        height: 100%;
        width: 100%;
        background: var(--nexus-terminal-background, #1e1e1e);
        color: var(--nexus-terminal-foreground, #ffffff);
        font-family: var(--nexus-font-family-mono, Menlo, Consolas, 'Courier New', monospace);
        font-size: var(--nexus-font-size-md, 13px);
        line-height: var(--nexus-font-line-height-normal, 1.5);
        padding: var(--nexus-space-2, 4px);
      }
      .nexus-terminal-host .xterm {
        height: 100%;
      }
    `;
    document.head.appendChild(style);
  }

  private applyTheme(theme: TerminalThemeOptions) {
    const terminal = this.term as unknown as {
      setOption?: (key: string, value: unknown) => void;
      options?: Record<string, unknown> & { theme?: Record<string, string | undefined> };
    };
    const normalized = {
      background: theme.background ?? '#1e1e1e',
      foreground: theme.foreground ?? '#ffffff',
      cursor: theme.cursor,
      selectionBackground: theme.selectionBackground,
      black: theme.black,
      red: theme.red,
      green: theme.green,
      yellow: theme.yellow,
      blue: theme.blue,
      magenta: theme.magenta,
      cyan: theme.cyan,
      white: theme.white,
      brightBlack: theme.brightBlack,
      brightRed: theme.brightRed,
      brightGreen: theme.brightGreen,
      brightYellow: theme.brightYellow,
      brightBlue: theme.brightBlue,
      brightMagenta: theme.brightMagenta,
      brightCyan: theme.brightCyan,
      brightWhite: theme.brightWhite
    };
    if (typeof terminal.setOption === 'function') {
      terminal.setOption('theme', normalized);
      if (typeof theme.fontFamily === 'string') {
        terminal.setOption('fontFamily', theme.fontFamily);
      }
      if (typeof theme.fontSize === 'number') {
        terminal.setOption('fontSize', theme.fontSize);
      }
      if (typeof theme.lineHeight === 'number') {
        terminal.setOption('lineHeight', theme.lineHeight);
      }
    } else if (terminal.options) {
      terminal.options.theme = normalized;
      if (typeof theme.fontFamily === 'string') {
        terminal.options.fontFamily = theme.fontFamily;
      }
      if (typeof theme.fontSize === 'number') {
        terminal.options.fontSize = theme.fontSize;
      }
      if (typeof theme.lineHeight === 'number') {
        terminal.options.lineHeight = theme.lineHeight;
      }
    }
    if (this.container) {
      this.container.style.background = normalized.background;
      this.container.style.color = normalized.foreground;
      if (theme.fontFamily) {
        this.container.style.fontFamily = theme.fontFamily;
      }
      if (typeof theme.fontSize === 'number') {
        this.container.style.fontSize = `${theme.fontSize}px`;
      }
      if (typeof theme.lineHeight === 'number') {
        this.container.style.lineHeight = String(theme.lineHeight);
      }
    }
  }
}
