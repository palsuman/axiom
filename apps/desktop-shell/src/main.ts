import { app, ipcMain, BrowserWindow, webContents } from 'electron';
import { readEnv } from '@nexus/platform/env';
import { WindowStateStore } from '@nexus/platform/window-state';
import {
  isIpcValidationError,
  type ValidatedIpcChannel,
  validateIpcPayload
} from '@nexus/contracts/ipc-validation';
import { log, logError } from './logger';
import type {
  WorkspaceBackupIdentifier
} from '@nexus/contracts/ipc';
import { WindowManager, type WorkspaceLaunchRequest } from './window-manager';
import { KeymapService } from './keymap-service';
import { MenuService } from './menu-service';
import { AssociationService } from './association-service';
import { resolveWorkspacePath } from './workspace-path';
import { UpdateService } from './update-service';
import { CrashService } from './crash-service';
import { StartupMetrics } from './startup-metrics';
import { WorkspaceHistoryStore } from '@nexus/platform/workspace-history';
import { ensureStorageLayout } from '@nexus/platform/storage-layout';
import { pickWorkspaceDirectory } from './workspace-dialog';
import { loadWorkspaceDescriptor } from '@nexus/platform/workspace-descriptor';
import { FileOperationsService } from './file-operations';
import { GitRepositoryService } from './git-repository-service';
import { TerminalService } from './terminal-service';
import { WorkspaceBackupManager } from '@nexus/platform/workspace-backup';

const env = readEnv();
const storageLayout = ensureStorageLayout(env, { logger: log });
if (storageLayout.migrations.length) {
  storageLayout.migrations.forEach(record => {
    const suffix = record.reason ? ` (${record.reason})` : '';
    log(`[storage] ${record.target} ${record.status}: ${record.from} -> ${record.to}${suffix}`);
  });
}
const stateStore = new WindowStateStore(env.nexusDataDir);
const windowManager = new WindowManager(stateStore, env);
const pendingWorkspaceRequests: WorkspaceLaunchRequest[] = [];
const keymapService = new KeymapService(env);
const menuService = new MenuService(windowManager, keymapService);
const associationService = new AssociationService(env);
const updateService = new UpdateService(env);
const crashService = new CrashService(env, windowManager);
const startupMetrics = new StartupMetrics(env);
const workspaceHistory = new WorkspaceHistoryStore({
  historyDir: env.workspaceDataDir
});
const fileOperations = new FileOperationsService(env, windowManager);
const gitRepositoryService = new GitRepositoryService();
const terminalService = new TerminalService();
const workspaceBackupManager = new WorkspaceBackupManager({ dataRoot: env.workspaceDataDir });

enqueueWorkspaceRequests(parseWorkspaceArgs(process.argv, process.cwd()));
crashService.initialize();
startupMetrics.mark('bootstrap:env-configured');
windowManager.onWindowReady(id => {
  startupMetrics.recordWindowReady(id);
  const session = windowManager.getSessionById(id);
  const roots = resolveWorkspaceRoots(session);
  if (session?.id && roots.length) {
    gitRepositoryService.trackSession(session.id, roots).catch(() => undefined);
  }
});
windowManager.onSessionRemoved(id => {
  gitRepositoryService.detachSession(id);
  terminalService.disposeBySession(id);
});

terminalService.on('data', payload => {
  const target = webContents.fromId(payload.ownerId);
  target?.send('nexus:terminal:data', { terminalId: payload.terminalId, data: payload.data });
});

terminalService.on('exit', payload => {
  const target = webContents.fromId(payload.ownerId);
  target?.send('nexus:terminal:exit', { terminalId: payload.terminalId, code: payload.code, signal: payload.signal });
});

function registerIpcHandlers() {
  startupMetrics.mark('bootstrap:ipc');
  ipcMain.handle('nexus:get-env', () => ({
    nexusEnv: env.nexusEnv,
    logLevel: env.logLevel
  }));

  ipcMain.on('nexus:log', (_event, payload) => {
    const validated = validatePayload('nexus:log', payload);
    if (!validated) {
      return;
    }
    log(`[renderer:${validated.level}]`, validated.message);
  });

  ipcMain.handle('nexus:new-window', () => {
    windowManager.createWindow();
    return true;
  });

  ipcMain.handle('nexus:get-window-session', event => {
    return windowManager.getSessionMetadataForWebContents(event.sender.id);
  });

  ipcMain.handle('nexus:open-workspace', (_event, payload) => {
    const payloadValue = requireValidPayload('nexus:open-workspace', payload);
    openWorkspaceAndRecord({ path: payloadValue.path, forceNew: payloadValue.forceNew });
    return true;
  });

  ipcMain.handle('nexus:get-recent-workspaces', () => workspaceHistory.list());
  ipcMain.handle('nexus:pick-workspace', async event => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const path = await pickWorkspaceDirectory(owner ?? undefined);
    return { path };
  });

  ipcMain.handle('nexus:check-for-updates', () => {
    return updateService.checkForUpdates();
  });

  ipcMain.handle('nexus:install-update', () => {
    return updateService.quitAndInstall();
  });

  ipcMain.handle('nexus:git:list-repositories', event => {
    const session = windowManager.getSessionMetadataForWebContents(event.sender.id);
    if (!session?.id) {
      return [];
    }
    return gitRepositoryService.listRepositories(session.id);
  });
  ipcMain.handle('nexus:git:get-status', (event, payload) => {
    const payloadValue = requireValidPayload('nexus:git:get-status', payload);
    const session = windowManager.getSessionMetadataForWebContents(event.sender.id);
    if (!session?.id) {
      throw new Error('Invalid git status request');
    }
    return gitRepositoryService.getStatus(session.id, payloadValue.repositoryId);
  });
  ipcMain.handle('nexus:git:stage', (event, payload) => {
    const payloadValue = requireValidPayload('nexus:git:stage', payload);
    const session = windowManager.getSessionMetadataForWebContents(event.sender.id);
    if (!session?.id) {
      throw new Error('Invalid git stage request');
    }
    return gitRepositoryService.stage(session.id, payloadValue);
  });
  ipcMain.handle('nexus:git:unstage', (event, payload) => {
    const payloadValue = requireValidPayload('nexus:git:unstage', payload);
    const session = windowManager.getSessionMetadataForWebContents(event.sender.id);
    if (!session?.id) {
      throw new Error('Invalid git unstage request');
    }
    return gitRepositoryService.unstage(session.id, payloadValue);
  });
  ipcMain.handle('nexus:git:get-diff', (event, payload) => {
    const payloadValue = requireValidPayload('nexus:git:get-diff', payload);
    const session = windowManager.getSessionMetadataForWebContents(event.sender.id);
    if (!session?.id) {
      throw new Error('Invalid git diff request');
    }
    return gitRepositoryService.getDiff(session.id, payloadValue);
  });
  ipcMain.handle('nexus:terminal:create', (event, payload) => {
    const payloadValue = requireValidPayload('nexus:terminal:create', payload);
    const session = windowManager.getSessionMetadataForWebContents(event.sender.id);
    if (!session?.id) {
      throw new Error('Invalid terminal session');
    }
    return terminalService.createTerminal(event.sender.id, session.id, payloadValue);
  });
  ipcMain.handle('nexus:terminal:write', (_event, payload) => {
    return terminalService.write(requireValidPayload('nexus:terminal:write', payload));
  });
  ipcMain.handle('nexus:terminal:resize', (_event, payload) => {
    return terminalService.resize(requireValidPayload('nexus:terminal:resize', payload));
  });
  ipcMain.handle('nexus:terminal:dispose', (_event, payload) => {
    return terminalService.dispose(requireValidPayload('nexus:terminal:dispose', payload));
  });
  ipcMain.handle('nexus:git:commit', (event, payload) => {
    const payloadValue = requireValidPayload('nexus:git:commit', payload);
    const session = windowManager.getSessionMetadataForWebContents(event.sender.id);
    if (!session?.id) {
      throw new Error('Invalid git commit request');
    }
    return gitRepositoryService.commit(session.id, payloadValue);
  });
  ipcMain.handle('nexus:git:get-history', (event, payload) => {
    const payloadValue = requireValidPayload('nexus:git:get-history', payload);
    const session = windowManager.getSessionMetadataForWebContents(event.sender.id);
    if (!session?.id) {
      throw new Error('Invalid git history request');
    }
    return gitRepositoryService.getHistory(session.id, payloadValue);
  });

  ipcMain.handle('nexus:fs:create', (event, payload) =>
    fileOperations.create(event.sender, requireValidPayload('nexus:fs:create', payload))
  );
  ipcMain.handle('nexus:fs:rename', (event, payload) =>
    fileOperations.rename(event.sender, requireValidPayload('nexus:fs:rename', payload))
  );
  ipcMain.handle('nexus:fs:move', (event, payload) =>
    fileOperations.move(event.sender, requireValidPayload('nexus:fs:move', payload))
  );
  ipcMain.handle('nexus:fs:copy', (event, payload) =>
    fileOperations.copy(event.sender, requireValidPayload('nexus:fs:copy', payload))
  );
  ipcMain.handle('nexus:fs:delete', (event, payload) =>
    fileOperations.delete(event.sender, requireValidPayload('nexus:fs:delete', payload))
  );
  ipcMain.handle('nexus:fs:undo', (event, payload) =>
    fileOperations.undo(event.sender, requireValidPayload('nexus:fs:undo', payload))
  );
  ipcMain.handle('nexus:workspace-backup:save', (_event, payload) => {
    const payloadValue = requireValidPayload('nexus:workspace-backup:save', payload);
    return workspaceBackupManager.save(payloadValue.workspaceId, payloadValue.snapshot);
  });
  ipcMain.handle('nexus:workspace-backup:load', (_event, payload) => {
    const payloadValue: WorkspaceBackupIdentifier = requireValidPayload('nexus:workspace-backup:load', payload);
    return workspaceBackupManager.load(payloadValue.workspaceId);
  });
  ipcMain.handle('nexus:workspace-backup:clear', (_event, payload) => {
    const payloadValue: WorkspaceBackupIdentifier = requireValidPayload('nexus:workspace-backup:clear', payload);
    return workspaceBackupManager.clear(payloadValue.workspaceId);
  });
}

function validatePayload<C extends ValidatedIpcChannel>(channel: C, payload: unknown) {
  try {
    return validateIpcPayload(channel, payload);
  } catch (error) {
    if (isIpcValidationError(error)) {
      logError(`[ipc] rejected ${channel} payload`, error);
      return undefined;
    }
    throw error;
  }
}

function requireValidPayload<C extends ValidatedIpcChannel>(channel: C, payload: unknown) {
  const validated = validatePayload(channel, payload);
  if (!validated) {
    throw new Error(`Invalid payload for ${channel}`);
  }
  return validated;
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', (event, argv, cwd) => {
    event.preventDefault();
    const requests = parseWorkspaceArgs(argv, cwd);
    if (requests.length) {
      enqueueWorkspaceRequests(requests);
    } else {
      windowManager.focusLastActiveWindow();
    }
  });
}

app.on('ready', () => {
  log('Electron app ready');
  startupMetrics.mark('app:ready');
  registerIpcHandlers();
  keymapService.initialize();
  menuService.install();
  associationService.registerProtocolHandlers();
  updateService.initialize();
  startupMetrics.mark('services:initialized');
  const sessionsRestored = windowManager.restorePreviousSessions();
  startupMetrics.mark('windows:restored');
  if (!sessionsRestored) {
    const recents = workspaceHistory.list();
    if (recents.length) {
      enqueueWorkspaceRequests([{ path: recents[0].path }]);
    } else {
      windowManager.createWindow();
    }
  }
  flushWorkspaceQueue();
  startupMetrics.mark('workspace:queue-flushed');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!windowManager.hasOpenWindows()) {
    windowManager.createWindow();
  }
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  enqueueWorkspaceRequests([{ path: filePath, forceNew: true }]);
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  const request = associationService.parseDeepLink(url);
  if (request) {
    enqueueWorkspaceRequests([request]);
  }
});

app.on('before-quit', () => {
  windowManager.persistSessions();
});

app.on('will-quit', () => {
  menuService.dispose();
  gitRepositoryService.dispose();
  keymapService.dispose();
  log('Application exiting');
});

function enqueueWorkspaceRequests(requests: WorkspaceLaunchRequest[]) {
  if (!requests.length) return;
  pendingWorkspaceRequests.push(...requests);
  flushWorkspaceQueue();
}

function flushWorkspaceQueue() {
  if (!app.isReady()) return;
  while (pendingWorkspaceRequests.length) {
    const request = pendingWorkspaceRequests.shift();
    if (!request) continue;
    try {
      openWorkspaceAndRecord(request);
    } catch (error) {
      logError(`Failed to open workspace ${request.path}`, error);
    }
  }
}

function openWorkspaceAndRecord(request: WorkspaceLaunchRequest) {
  const descriptor = loadWorkspaceDescriptor(request.path);
  const browserWindow = windowManager.openWorkspace({
    path: descriptor.descriptorPath ?? descriptor.primary,
    forceNew: request.forceNew,
    descriptor
  });
  const session = browserWindow
    ? windowManager.getSessionMetadataForWebContents(browserWindow.webContents.id)
    : undefined;
  const roots = resolveWorkspaceRoots(session);
  if (session?.id && roots.length) {
    gitRepositoryService.trackSession(session.id, roots).catch(() => undefined);
  }
  const historyPayload = {
    path: descriptor.descriptorPath ?? descriptor.primary,
    descriptorPath: descriptor.descriptorPath,
    roots: descriptor.roots,
    label: descriptor.label,
    primary: descriptor.primary
  };
  try {
    workspaceHistory.record(historyPayload);
  } catch (error) {
    logError(`Failed to record workspace ${descriptor.primary}`, error);
  }
}

type SessionLike = {
  workspace?: string;
  workspaceRoots?: string[];
};

function resolveWorkspaceRoots(session?: SessionLike) {
  if (!session) return [];
  if (session.workspaceRoots && session.workspaceRoots.length) {
    return session.workspaceRoots;
  }
  if (session.workspace) {
    return [session.workspace];
  }
  return [];
}

function parseWorkspaceArgs(argv: string[], cwd: string): WorkspaceLaunchRequest[] {
  if (!Array.isArray(argv)) return [];
  const requests: WorkspaceLaunchRequest[] = [];
  const normalizedCwd = cwd || process.cwd();
  const forceNew = argv.includes('--new-window');
  let skipNext = false;
  for (let i = 1; i < argv.length; i++) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    const arg = argv[i];
    if (!arg) continue;
    if (arg === '--') break;
    if (process.platform === 'darwin' && arg.startsWith('-psn_')) continue;
    if (arg.startsWith('nexus://')) {
      const deepLinkRequest = associationService.parseDeepLink(arg, normalizedCwd);
      if (deepLinkRequest) {
        if (deepLinkRequest.forceNew === undefined) {
          deepLinkRequest.forceNew = forceNew;
        }
        requests.push(deepLinkRequest);
      }
      continue;
    }
    if (arg.startsWith('--workspace=')) {
      const value = arg.split('=').slice(1).join('=');
      if (value) {
        requests.push({ path: resolveWorkspacePath(value, normalizedCwd), forceNew });
      }
      continue;
    }
    if (arg === '--workspace' && argv[i + 1]) {
      const value = argv[i + 1];
      requests.push({ path: resolveWorkspacePath(value, normalizedCwd), forceNew });
      skipNext = true;
      continue;
    }
    if (arg.startsWith('-')) continue;
    requests.push({ path: resolveWorkspacePath(arg, normalizedCwd), forceNew });
  }
  return requests;
}
