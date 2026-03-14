import { BrowserWindow, nativeTheme } from 'electron';
import path from 'node:path';
import { log, logError } from './logger';
import type { NexusEnv } from '@nexus/platform/env';
import { WindowStateStore, StoredWindowState, WindowBounds } from '@nexus/platform/window-state';
import { loadWorkspaceDescriptor, type WorkspaceDescriptor } from '@nexus/platform/workspace-descriptor';

type WindowSessionSnapshot = StoredWindowState & {
  lastOpenedAt: number;
  lastFocusedAt: number;
};

export type WorkspaceLaunchRequest = {
  path: string;
  forceNew?: boolean;
  descriptor?: WorkspaceDescriptor;
};

type CreateWindowOptions = {
  state?: StoredWindowState;
  workspace?: string | null;
  descriptor?: WorkspaceDescriptor;
};

const MAX_SNAPSHOTS = 8;

export class WindowManager {
  private windows = new Map<string, BrowserWindow>();
  private webContentsToSession = new Map<number, string>();
  private workspaceIndex = new Map<string, string>();
  private sessions = new Map<string, WindowSessionSnapshot>();
  private lastFocusedId: string | null = null;
  private windowReadyListeners: Array<(id: string) => void> = [];
  private sessionRemovedListeners: Array<(id: string) => void> = [];

  constructor(private readonly store: WindowStateStore, private readonly env: NexusEnv) {}

  restorePreviousSessions() {
    const states = this.store.getAll();
    if (!states.length) {
      return false;
    }
    states.slice(0, MAX_SNAPSHOTS).forEach(state => this.createWindow({ state }));
    return true;
  }

  createWindow(options: CreateWindowOptions = {}) {
    const snapshot = this.buildInitialSnapshot(options);
    const titleLabel = snapshot.workspaceLabel ?? (snapshot.workspace ? path.basename(snapshot.workspace) : null);
    const additionalArguments: string[] = [];
    if (snapshot.workspace) {
      additionalArguments.push(`--workspace=${encodeURIComponent(snapshot.workspace)}`);
    }
    if (snapshot.workspacePrimary) {
      additionalArguments.push(`--workspace-primary=${encodeURIComponent(snapshot.workspacePrimary)}`);
    }
    if (snapshot.workspaceDescriptor) {
      additionalArguments.push(`--workspace-config=${encodeURIComponent(snapshot.workspaceDescriptor)}`);
    }
    if (snapshot.workspaceRoots?.length) {
      additionalArguments.push(`--workspace-roots=${encodeURIComponent(JSON.stringify(snapshot.workspaceRoots))}`);
    }
    const window = new BrowserWindow({
      width: snapshot.bounds.width ?? 1280,
      height: snapshot.bounds.height ?? 820,
      x: snapshot.bounds.x,
      y: snapshot.bounds.y,
      show: false,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff',
      title: titleLabel ? `Nexus IDE — ${titleLabel}` : 'Nexus IDE',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        additionalArguments: additionalArguments.length ? additionalArguments : undefined
      }
    });

    window.once('ready-to-show', () => {
      window.show();
      this.windowReadyListeners.forEach(listener => listener(snapshot.id));
    });
    window.on('focus', () => this.markFocused(snapshot.id));
    window.on('move', () => this.captureBounds(snapshot.id));
    window.on('resize', () => this.captureBounds(snapshot.id));
    window.on('close', () => this.captureBounds(snapshot.id));
    window.on('closed', () => this.destroyWindow(snapshot.id));

    this.loadStartContent(window, snapshot.workspacePrimary ?? snapshot.workspace);
    if (this.env.nexusEnv === 'development') {
      try {
        window.webContents.openDevTools({ mode: 'detach' });
      } catch (error) {
        logError('Failed to open devtools', error);
      }
    }

    this.windows.set(snapshot.id, window);
    this.sessions.set(snapshot.id, snapshot);
    this.webContentsToSession.set(window.webContents.id, snapshot.id);
    if (snapshot.workspace) {
      this.workspaceIndex.set(this.toWorkspaceKey(snapshot.workspace), snapshot.id);
    }

    return window;
  }

  openWorkspace(request: WorkspaceLaunchRequest) {
    const descriptor = request.descriptor ?? loadWorkspaceDescriptor(request.path);
    const workspaceKey = descriptor.descriptorPath ?? descriptor.primary;
    const workspace = this.normalizeWorkspacePath(workspaceKey);
    if (!workspace) {
      throw new Error('Workspace path is required');
    }
    if (!request.forceNew) {
      const existing = this.findWindowByWorkspace(workspace);
      if (existing) {
        existing.focus();
        return existing;
      }
    }
    return this.createWindow({ workspace, descriptor });
  }

  focusLastActiveWindow() {
    if (this.lastFocusedId) {
      const win = this.windows.get(this.lastFocusedId);
      if (win) {
        win.focus();
        return;
      }
    }
    const first = this.windows.values().next().value as BrowserWindow | undefined;
    if (first) first.focus();
  }

  persistSessions() {
    const snapshots = Array.from(this.sessions.values())
      .sort((a, b) => (b.lastFocusedAt ?? 0) - (a.lastFocusedAt ?? 0))
      .slice(0, MAX_SNAPSHOTS);
    this.store.replaceAll(snapshots);
  }

  hasOpenWindows() {
    return this.windows.size > 0;
  }

  getSessionMetadataForWebContents(webContentsId: number) {
    const sessionId = this.webContentsToSession.get(webContentsId);
    if (!sessionId) return undefined;
    const snapshot = this.sessions.get(sessionId);
    if (!snapshot) return undefined;
    const { id, workspace, lastOpenedAt, lastFocusedAt, workspaceLabel, workspaceRoots, workspaceDescriptor, workspacePrimary } = snapshot;
    return { id, workspace, lastOpenedAt, lastFocusedAt, workspaceLabel, workspaceRoots, descriptorPath: workspaceDescriptor ?? undefined, workspacePrimary };
  }

  markWorkspace(sessionId: string, workspacePath: string | undefined) {
    const normalized = this.normalizeWorkspacePath(workspacePath);
    const snapshot = this.sessions.get(sessionId);
    if (!snapshot) return;
    if (snapshot.workspace) {
      this.workspaceIndex.delete(this.toWorkspaceKey(snapshot.workspace));
    }
    if (normalized) {
      this.workspaceIndex.set(this.toWorkspaceKey(normalized), sessionId);
    }
    snapshot.workspace = normalized;
  }

  onWindowReady(listener: (id: string) => void) {
    this.windowReadyListeners.push(listener);
  }

  onSessionRemoved(listener: (id: string) => void) {
    this.sessionRemovedListeners.push(listener);
  }

  getSessionById(sessionId: string) {
    return this.sessions.get(sessionId);
  }

  private findWindowByWorkspace(workspacePath: string) {
    const key = this.toWorkspaceKey(workspacePath);
    const sessionId = this.workspaceIndex.get(key);
    if (!sessionId) return undefined;
    return this.windows.get(sessionId);
  }

  private buildInitialSnapshot(options: CreateWindowOptions): WindowSessionSnapshot {
    const state = options.state;
    const id = state?.id ?? this.store.nextId();
    const bounds = this.normalizeBounds(state?.bounds);
    const workspace = this.normalizeWorkspacePath(state?.workspace ?? options.workspace ?? undefined);
    const workspacePrimary =
      this.normalizeWorkspacePath(options.descriptor?.primary) ??
      this.normalizeWorkspacePath(state?.workspacePrimary ?? undefined) ??
      workspace;
    const descriptorPath = this.normalizeWorkspacePath(options.descriptor?.descriptorPath ?? state?.workspaceDescriptor);
    const workspaceRoots =
      options.descriptor?.roots?.map((root: string) => this.normalizeWorkspacePath(root)).filter(Boolean) ??
      state?.workspaceRoots ??
      (workspacePrimary ? [workspacePrimary] : undefined);
    const workspaceLabel = options.descriptor?.label ?? state?.workspaceLabel ?? (workspace ? path.basename(workspace) : undefined);
    const timestamp = Date.now();
    return {
      id,
      bounds,
      workspace,
       workspacePrimary: workspacePrimary ?? undefined,
      workspaceDescriptor: descriptorPath ?? undefined,
      workspaceRoots: workspaceRoots as string[] | undefined,
      workspaceLabel,
      lastOpenedAt: state?.lastOpenedAt ?? timestamp,
      lastFocusedAt: state?.lastFocusedAt ?? timestamp
    };
  }

  private normalizeBounds(bounds?: WindowBounds): WindowBounds {
    if (!bounds) {
      return { width: 1280, height: 820 };
    }
    return {
      width: bounds.width ?? 1280,
      height: bounds.height ?? 820,
      x: bounds.x,
      y: bounds.y
    };
  }

  private normalizeWorkspacePath(workspace?: string | null) {
    if (!workspace) return undefined;
    const trimmed = workspace.trim();
    if (!trimmed) return undefined;
    return path.resolve(trimmed);
  }

  private toWorkspaceKey(workspace: string) {
    return process.platform === 'win32' ? workspace.toLowerCase() : workspace;
  }

  private captureBounds(sessionId: string) {
    const window = this.windows.get(sessionId);
    if (!window) return;
    const snapshot = this.sessions.get(sessionId);
    if (!snapshot) return;
    snapshot.bounds = window.getBounds();
  }

  private destroyWindow(sessionId: string) {
    const window = this.windows.get(sessionId);
    if (window) {
      this.webContentsToSession.delete(window.webContents.id);
    }
    this.windows.delete(sessionId);
    const snapshot = this.sessions.get(sessionId);
    if (snapshot?.workspace) {
      this.workspaceIndex.delete(this.toWorkspaceKey(snapshot.workspace));
    }
    this.sessions.delete(sessionId);
    if (this.lastFocusedId === sessionId) {
      this.lastFocusedId = null;
    }
    this.sessionRemovedListeners.forEach(listener => listener(sessionId));
  }

  private markFocused(sessionId: string) {
    const snapshot = this.sessions.get(sessionId);
    if (!snapshot) return;
    snapshot.lastFocusedAt = Date.now();
    this.lastFocusedId = sessionId;
  }

  private loadStartContent(window: BrowserWindow, workspace?: string) {
    try {
      const result = window.loadURL(this.getStartUrl(workspace)) as unknown;
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(error => logError('Failed to load start URL', error));
      }
    } catch (error) {
      logError('Failed to load start URL', error);
    }
  }

  private getStartUrl(workspace?: string) {
    const workspaceLabel = workspace ? this.escapeHtml(workspace) : 'Not set';
    const message = encodeURIComponent(
      `<style>body{background:#1e1e1e;color:#fff;font-family:system-ui, sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}h1{margin-bottom:0.25rem;font-size:2rem;text-align:center;}p{text-align:center;margin:0;opacity:0.8;}code{display:inline-block;margin-top:0.5rem;padding:0.25rem 0.5rem;background:rgba(255,255,255,0.1);border-radius:4px;}</style><body><div><h1>Nexus IDE</h1><p>ENV: ${this.env.nexusEnv}</p><p>Workspace: <code>${workspaceLabel}</code></p></div></body>`
    );
    return `data:text/html,${message}`;
  }

  private escapeHtml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
