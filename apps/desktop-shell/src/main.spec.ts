import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type AppEventHandler = (...args: unknown[]) => unknown;
type IpcHandler = (...args: unknown[]) => unknown;

jest.mock('electron', () => {
  const appEvents = new Map<string, AppEventHandler>();
  const ipcHandleHandlers = new Map<string, IpcHandler>();
  const ipcOnHandlers = new Map<string, IpcHandler>();
  let isReady = false;

  const mockState = {
    emitApp(event: string, ...args: unknown[]) {
      if (event === 'ready') {
        isReady = true;
      }
      const handler = appEvents.get(event);
      if (!handler) {
        throw new Error(`Missing app handler for ${event}`);
      }
      return handler(...args);
    },
    getHandle(channel: string) {
      const handler = ipcHandleHandlers.get(channel);
      if (!handler) {
        throw new Error(`Missing ipcMain.handle registration for ${channel}`);
      }
      return handler;
    },
    getOn(channel: string) {
      const handler = ipcOnHandlers.get(channel);
      if (!handler) {
        throw new Error(`Missing ipcMain.on registration for ${channel}`);
      }
      return handler;
    }
  };

  return {
    __mock: mockState,
    app: {
      on: jest.fn((event: string, handler: AppEventHandler) => {
        appEvents.set(event, handler);
      }),
      quit: jest.fn(),
      isReady: jest.fn(() => isReady),
      requestSingleInstanceLock: jest.fn(() => true),
      isDefaultProtocolClient: jest.fn(() => false),
      setAsDefaultProtocolClient: jest.fn(() => true)
    },
    BrowserWindow: {
      fromWebContents: jest.fn(() => undefined)
    },
    Menu: {
      buildFromTemplate: jest.fn(() => ({
        items: [],
        getMenuItemById: jest.fn()
      })),
      setApplicationMenu: jest.fn()
    },
    dialog: {
      showOpenDialog: jest.fn().mockResolvedValue({ canceled: true, filePaths: [] })
    },
    shell: { openExternal: jest.fn() },
    autoUpdater: {
      setFeedURL: jest.fn(),
      checkForUpdates: jest.fn(),
      quitAndInstall: jest.fn(),
      on: jest.fn().mockReturnThis()
    },
    nativeTheme: { shouldUseDarkColors: false },
    ipcMain: {
      handle: jest.fn((channel: string, handler: IpcHandler) => {
        ipcHandleHandlers.set(channel, handler);
      }),
      on: jest.fn((channel: string, handler: IpcHandler) => {
        ipcOnHandlers.set(channel, handler);
      })
    },
    webContents: {
      fromId: jest.fn(() => undefined)
    }
  };
});

jest.mock('./system/logger', () => ({
  log: jest.fn(),
  logError: jest.fn()
}));

jest.mock('./windowing/window-manager', () => {
  const state = {
    createWindow: jest.fn(() => ({ webContents: { id: 91 } })),
    focusLastActiveWindow: jest.fn(),
    getSessionMetadataForWebContents: jest.fn(() => ({ id: 'session-1', workspace: '/workspace' })),
    hasOpenWindows: jest.fn(() => false),
    onSessionRemoved: jest.fn(),
    onWindowReady: jest.fn(),
    openWorkspace: jest.fn(() => ({ webContents: { id: 91 } })),
    persistSessions: jest.fn(),
    restorePreviousSessions: jest.fn(() => false)
  };

  return {
    __mock: state,
    WindowManager: jest.fn().mockImplementation(() => state)
  };
});

jest.mock('./windowing/keymap-service', () => ({
  KeymapService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    dispose: jest.fn()
  }))
}));

jest.mock('./windowing/menu-service', () => ({
  MenuService: jest.fn().mockImplementation(() => ({
    install: jest.fn(),
    dispose: jest.fn()
  }))
}));

jest.mock('./system/association-service', () => ({
  AssociationService: jest.fn().mockImplementation(() => ({
    registerProtocolHandlers: jest.fn(),
    parseDeepLink: jest.fn(() => undefined)
  }))
}));

jest.mock('./system/update-service', () => ({
  UpdateService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    checkForUpdates: jest.fn(),
    quitAndInstall: jest.fn()
  }))
}));

jest.mock('./system/crash-service', () => ({
  CrashService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn()
  }))
}));

jest.mock('./system/startup-metrics', () => ({
  StartupMetrics: jest.fn().mockImplementation(() => ({
    mark: jest.fn(),
    recordWindowReady: jest.fn()
  }))
}));

jest.mock('./workspace/workspace-dialog', () => ({
  pickWorkspaceDirectory: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('./filesystem/file-operations', () => {
  const state = {
    create: jest.fn(),
    rename: jest.fn(),
    move: jest.fn(),
    copy: jest.fn(),
    delete: jest.fn(),
    undo: jest.fn()
  };

  return {
    __mock: state,
    FileOperationsService: jest.fn().mockImplementation(() => state)
  };
});

jest.mock('./scm/git-repository-service', () => {
  const state = {
    commit: jest.fn(),
    detachSession: jest.fn(),
    dispose: jest.fn(),
    getDiff: jest.fn(),
    getHistory: jest.fn(),
    getStatus: jest.fn(),
    listRepositories: jest.fn(),
    stage: jest.fn(),
    trackSession: jest.fn().mockResolvedValue(undefined),
    unstage: jest.fn()
  };

  return {
    __mock: state,
    GitRepositoryService: jest.fn().mockImplementation(() => state)
  };
});

jest.mock('./terminal/terminal-service', () => {
  const state = {
    createTerminal: jest.fn(),
    dispose: jest.fn(),
    disposeBySession: jest.fn(),
    on: jest.fn(),
    resize: jest.fn(),
    write: jest.fn()
  };

  return {
    __mock: state,
    TerminalService: jest.fn().mockImplementation(() => state)
  };
});

jest.mock('@nexus/platform/workspace/workspace-history', () => ({
  WorkspaceHistoryStore: jest.fn().mockImplementation(() => ({
    list: jest.fn(() => []),
    record: jest.fn()
  }))
}));

jest.mock('@nexus/platform/workspace/storage-layout', () => ({
  ensureStorageLayout: jest.fn(() => ({
    migrations: []
  }))
}));

jest.mock('@nexus/platform/workspace/workspace-descriptor', () => ({
  loadWorkspaceDescriptor: jest.fn((workspacePath: string) => ({
    descriptorPath: undefined,
    primary: workspacePath,
    roots: [workspacePath],
    label: path.basename(workspacePath)
  }))
}));

jest.mock('@nexus/platform/workspace/workspace-backup', () => {
  const state = {
    clear: jest.fn(),
    load: jest.fn(),
    save: jest.fn()
  };

  return {
    __mock: state,
    WorkspaceBackupManager: jest.fn().mockImplementation(() => state)
  };
});

describe('desktop shell main process', () => {
  let tmpHome: string;
  let homedirSpy: jest.SpyInstance<string, []>;
  let electron: {
    emitApp: (event: string, ...args: unknown[]) => unknown;
    getHandle: (channel: string) => IpcHandler;
    getOn: (channel: string) => IpcHandler;
  };

  beforeAll(async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-main-test-'));
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(tmpHome);
    process.env.NEXUS_HOME = tmpHome;
    process.env.NEXUS_DATA_DIR = tmpHome;
    process.env.NEXUS_WORKSPACE_DATA = path.join(tmpHome, 'workspaces');
    electron = await loadMainProcess();
  });

  afterAll(() => {
    delete process.env.NEXUS_HOME;
    delete process.env.NEXUS_DATA_DIR;
    delete process.env.NEXUS_WORKSPACE_DATA;
    homedirSpy?.mockRestore();
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers IPC handlers on app ready', async () => {
    expect(typeof electron.getHandle('nexus:open-workspace')).toBe('function');
    expect(typeof electron.getHandle('nexus:git:stage')).toBe('function');
    expect(typeof electron.getOn('nexus:log')).toBe('function');
  });

  it('rejects invalid workspace payloads before opening windows', async () => {
    const windowManager = jest.requireMock('./windowing/window-manager') as {
      __mock: { openWorkspace: jest.Mock };
    };
    const logger = jest.requireMock('./system/logger') as { logError: jest.Mock };

    const handler = electron.getHandle('nexus:open-workspace');

    expect(() => handler({}, { path: 42 })).toThrow(/Invalid payload for nexus:open-workspace/);
    expect(windowManager.__mock.openWorkspace).not.toHaveBeenCalled();
    expect(logger.logError).toHaveBeenCalledWith(
      '[ipc] rejected nexus:open-workspace payload',
      expect.any(Error)
    );
  });

  it('rejects invalid git stage payloads before repository access', async () => {
    const gitRepository = jest.requireMock('./scm/git-repository-service') as {
      __mock: { stage: jest.Mock };
    };

    const handler = electron.getHandle('nexus:git:stage');

    expect(() => handler({ sender: { id: 7 } }, { repositoryId: '', paths: [] })).toThrow(
      /Invalid payload for nexus:git:stage/
    );
    expect(gitRepository.__mock.stage).not.toHaveBeenCalled();
  });

  it('normalizes valid renderer logs and ignores malformed payloads', async () => {
    const logger = jest.requireMock('./system/logger') as {
      log: jest.Mock;
      logError: jest.Mock;
    };

    const handler = electron.getOn('nexus:log');

    handler({}, { level: 'warn', message: '  renderer boot  ' });
    handler({}, { level: 'verbose', message: 'bad' });

    expect(logger.log).toHaveBeenCalledWith('[renderer:warn]', 'renderer boot');
    expect(logger.logError).toHaveBeenCalledWith('[ipc] rejected nexus:log payload', expect.any(Error));
  });
});

async function loadMainProcess() {
  await import('./main');
  const electron = jest.requireMock('electron') as {
    __mock: {
      emitApp: (event: string, ...args: unknown[]) => unknown;
      getHandle: (channel: string) => IpcHandler;
      getOn: (channel: string) => IpcHandler;
    };
  };
  electron.__mock.emitApp('ready');
  return electron.__mock;
}
