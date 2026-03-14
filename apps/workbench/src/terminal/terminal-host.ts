import { TerminalClient } from './terminal-client';
import type { TerminalDescriptor, WorkspaceBackupTerminal } from '@nexus/contracts/ipc';
import { TerminalSnapshotBuffer } from './terminal-snapshot-buffer';

type Terminal = import('xterm').Terminal;
type FitAddon = import('xterm-addon-fit').FitAddon;

type TerminalHostOptions = {
  container?: HTMLElement;
  theme?: { background?: string; foreground?: string };
  bufferLimit?: number;
};

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

  constructor(options: TerminalHostOptions = {}, client = new TerminalClient()) {
    this.client = client;
    this.snapshotBuffer = new TerminalSnapshotBuffer(options.bufferLimit);
    const TerminalCtor = require('xterm').Terminal as typeof import('xterm').Terminal;
    const FitAddonCtor = require('xterm-addon-fit').FitAddon as typeof import('xterm-addon-fit').FitAddon;
    this.term = new TerminalCtor({
      convertEol: true,
      cursorBlink: true,
      theme: {
        background: options.theme?.background ?? '#1e1e1e',
        foreground: options.theme?.foreground ?? '#ffffff'
      }
    });
    this.fitAddon = new FitAddonCtor();
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

  dispose() {
    this.disposeData?.();
    this.disposeExit?.();
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.handleResize);
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
        background: #1e1e1e;
        color: #ffffff;
        font-family: Menlo, Consolas, 'Courier New', monospace;
      }
      .nexus-terminal-host .xterm {
        height: 100%;
      }
    `;
    document.head.appendChild(style);
  }
}
