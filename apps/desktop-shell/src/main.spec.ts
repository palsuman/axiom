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

jest.mock('./system/telemetry-service', () => {
  const state = {
    track: jest.fn(),
    trackRendererLog: jest.fn(),
    replay: jest.fn(() => ({
      records: [],
      totalBuffered: 0,
      dropped: 0,
      bufferPath: '/tmp/telemetry/events.jsonl'
    })),
    getHealth: jest.fn(() => ({
      bufferPath: '/tmp/telemetry/events.jsonl',
      eventCount: 0,
      fileBytes: 0,
      dropped: 0,
      lastSequence: 0,
      oldestRecordedAt: undefined,
      newestRecordedAt: undefined,
      levels: {
        error: 0,
        warn: 0,
        info: 0,
        debug: 0
      },
      scopes: {
        main: 0,
        renderer: 0,
        preload: 0,
        shared: 0
      }
    }))
  };

  return {
    __mock: state,
    TelemetryService: jest.fn().mockImplementation(() => state)
  };
});

jest.mock('./system/privacy-service', () => {
  const state = {
    getSnapshot: jest.fn(() => ({
      workspaceId: 'workspace-1',
      categories: [
        {
          key: 'usageTelemetry',
          title: 'Usage & diagnostics telemetry',
          description: 'Collect local diagnostics and usage events.'
        },
        {
          key: 'crashReports',
          title: 'Crash report sharing',
          description: 'Allow crash report sending.'
        }
      ],
      user: {
        scope: 'user',
        source: 'default',
        preferences: {
          usageTelemetry: true,
          crashReports: false
        }
      },
      workspace: {
        scope: 'workspace',
        workspaceId: 'workspace-1',
        source: 'default',
        preferences: {
          usageTelemetry: true,
          crashReports: false
        }
      },
      effective: {
        scope: 'workspace',
        workspaceId: 'workspace-1',
        source: 'default',
        preferences: {
          usageTelemetry: true,
          crashReports: false
        }
      },
      telemetry: {
        bufferPath: '/tmp/telemetry/events.jsonl',
        eventCount: 0,
        fileBytes: 0,
        dropped: 0,
        lastSequence: 0,
        oldestRecordedAt: undefined,
        newestRecordedAt: undefined,
        levels: { error: 0, warn: 0, info: 0, debug: 0 },
        scopes: { main: 0, renderer: 0, preload: 0, shared: 0 },
        collectionEnabled: true
      }
    })),
    updateConsent: jest.fn(),
    exportData: jest.fn(),
    deleteData: jest.fn(),
    isTelemetryEnabled: jest.fn(() => true),
    canShareCrashReports: jest.fn(() => true)
  };

  return {
    __mock: state,
    PrivacyService: jest.fn().mockImplementation(() => state)
  };
});

jest.mock('./system/feature-flag-service', () => {
  const state = {
    initialize: jest.fn(() => ({
      flags: [],
      activeKeys: [],
      summary: '',
      sources: ['env'],
      unknownFlags: [],
      loadErrors: []
    })),
    refreshRemote: jest.fn().mockResolvedValue({
      flags: [],
      activeKeys: [],
      summary: '',
      sources: ['env'],
      unknownFlags: [],
      loadErrors: []
    }),
    list: jest.fn(() => ({
      flags: [],
      activeKeys: [],
      summary: '',
      sources: ['env'],
      unknownFlags: [],
      loadErrors: []
    })),
    isEnabled: jest.fn(() => true),
    getTelemetrySummary: jest.fn(() => '')
  };

  return {
    __mock: state,
    FeatureFlagService: jest.fn().mockImplementation(() => state)
  };
});

jest.mock('./ai/llama-controller-service', () => {
  const state = {
    getHealth: jest.fn().mockResolvedValue({
      status: 'stopped',
      installRoot: '/tmp/.nexus/ai/llama.cpp',
      installed: false,
      endpoint: 'http://127.0.0.1:39281/health',
      host: '127.0.0.1',
      port: 39281,
      process: {
        restarts: 0,
        restartOnCrash: true
      },
      health: {
        ok: false,
        checkedAt: Date.now(),
        error: 'controller not started'
      },
      recentOutput: []
    }),
    start: jest.fn(),
    stop: jest.fn(),
    benchmark: jest.fn().mockResolvedValue({
      iterations: 3,
      warmupIterations: 1,
      endpoint: 'http://127.0.0.1:39281/health',
      samples: [],
      summary: {
        successes: 0,
        failures: 3
      }
    })
  };

  return {
    __mock: state,
    LlamaControllerService: jest.fn().mockImplementation(() => state)
  };
});

jest.mock('./ai/llama-model-registry-service', () => {
  const state = {
    listModels: jest.fn().mockResolvedValue({
      modelRoot: '/tmp/.nexus/ai/models',
      registryPath: '/tmp/.nexus/ai/model-registry.json',
      discoveredAt: Date.now(),
      models: []
    }),
    importModel: jest.fn().mockResolvedValue({
      modelRoot: '/tmp/.nexus/ai/models',
      imported: [],
      skipped: []
    })
  };

  return {
    __mock: state,
    LlamaModelRegistryService: jest.fn().mockImplementation(() => state)
  };
});

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

jest.mock('./run-debug/launch-configuration-service', () => {
  const state = {
    load: jest.fn().mockResolvedValue({
      path: '/workspace/.nexus/launch.json',
      exists: false,
      text: '{\n  "version": "1.0.0",\n  "configurations": []\n}',
      issues: []
    }),
    save: jest.fn().mockResolvedValue({
      path: '/workspace/.nexus/launch.json',
      saved: true,
      text: '{\n  "version": "1.0.0",\n  "configurations": []\n}',
      issues: []
    })
  };

  return {
    __mock: state,
    LaunchConfigurationService: jest.fn().mockImplementation(() => state)
  };
});

jest.mock('./run-debug/debug-adapter-host-service', () => {
  const state = {
    evaluate: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    stopSessionByWorkspaceSession: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn(),
    on: jest.fn()
  };

  return {
    __mock: state,
    DebugAdapterHostService: jest.fn().mockImplementation(() => state)
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
    expect(typeof electron.getHandle('nexus:debug:start')).toBe('function');
    expect(typeof electron.getHandle('nexus:debug:evaluate')).toBe('function');
    expect(typeof electron.getHandle('nexus:telemetry:track')).toBe('function');
    expect(typeof electron.getHandle('nexus:telemetry:replay')).toBe('function');
    expect(typeof electron.getHandle('nexus:telemetry:health')).toBe('function');
    expect(typeof electron.getHandle('nexus:privacy:get-consent')).toBe('function');
    expect(typeof electron.getHandle('nexus:privacy:update-consent')).toBe('function');
    expect(typeof electron.getHandle('nexus:privacy:export-data')).toBe('function');
    expect(typeof electron.getHandle('nexus:privacy:delete-data')).toBe('function');
    expect(typeof electron.getHandle('nexus:feature-flags:list')).toBe('function');
    expect(typeof electron.getHandle('nexus:ai:controller:health')).toBe('function');
    expect(typeof electron.getHandle('nexus:ai:controller:start')).toBe('function');
    expect(typeof electron.getHandle('nexus:ai:controller:stop')).toBe('function');
    expect(typeof electron.getHandle('nexus:ai:controller:benchmark')).toBe('function');
    expect(typeof electron.getHandle('nexus:ai:model:list')).toBe('function');
    expect(typeof electron.getHandle('nexus:ai:model:import')).toBe('function');
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

  it('rejects invalid debug start payloads before creating debug sessions', async () => {
    const debugHost = jest.requireMock('./run-debug/debug-adapter-host-service') as {
      __mock: { start: jest.Mock };
    };

    const handler = electron.getHandle('nexus:debug:start');

    expect(() => handler({ sender: { id: 9 } }, { configurationIndex: -1 })).toThrow(
      /Invalid payload for nexus:debug:start/
    );
    expect(debugHost.__mock.start).not.toHaveBeenCalled();
  });

  it('rejects invalid debug evaluate payloads before evaluating expressions', async () => {
    const debugHost = jest.requireMock('./run-debug/debug-adapter-host-service') as {
      __mock: { evaluate: jest.Mock };
    };

    const handler = electron.getHandle('nexus:debug:evaluate');

    expect(() => handler({ sender: { id: 9 } }, { expression: '' })).toThrow(
      /Invalid payload for nexus:debug:evaluate/
    );
    expect(debugHost.__mock.evaluate).not.toHaveBeenCalled();
  });

  it('normalizes valid renderer logs and ignores malformed payloads', async () => {
    const logger = jest.requireMock('./system/logger') as {
      log: jest.Mock;
      logError: jest.Mock;
    };
    const telemetry = jest.requireMock('./system/telemetry-service') as {
      __mock: { trackRendererLog: jest.Mock };
    };

    const handler = electron.getOn('nexus:log');

    handler({}, { level: 'warn', message: '  renderer boot  ' });
    handler({}, { level: 'verbose', message: 'bad' });

    expect(logger.log).toHaveBeenCalledWith('[renderer:warn]', 'renderer boot');
    expect(telemetry.__mock.trackRendererLog).toHaveBeenCalledWith({
      level: 'warn',
      message: 'renderer boot'
    });
    expect(logger.logError).toHaveBeenCalledWith('[ipc] rejected nexus:log payload', expect.any(Error));
  });

  it('routes telemetry IPC calls through the telemetry service', async () => {
    const telemetry = jest.requireMock('./system/telemetry-service') as {
      __mock: {
        track: jest.Mock;
        replay: jest.Mock;
        getHealth: jest.Mock;
      };
    };

    const trackHandler = electron.getHandle('nexus:telemetry:track');
    const replayHandler = electron.getHandle('nexus:telemetry:replay');
    const healthHandler = electron.getHandle('nexus:telemetry:health');

    trackHandler({}, { name: 'renderer.command', scope: 'renderer' });
    replayHandler({}, { limit: 10 });
    healthHandler({});

    expect(telemetry.__mock.track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'renderer.command',
        scope: 'renderer'
      })
    );
    expect(telemetry.__mock.replay).toHaveBeenCalledWith({ limit: 10 });
    expect(telemetry.__mock.getHealth).toHaveBeenCalled();
  });

  it('routes feature-flag IPC calls through the feature flag service', async () => {
    const featureFlags = jest.requireMock('./system/feature-flag-service') as {
      __mock: { list: jest.Mock };
    };

    const handler = electron.getHandle('nexus:feature-flags:list');
    handler({});

    expect(featureFlags.__mock.list).toHaveBeenCalled();
  });

  it('routes AI controller IPC calls through the llama controller service', async () => {
    const controller = jest.requireMock('./ai/llama-controller-service') as {
      __mock: {
        getHealth: jest.Mock;
        start: jest.Mock;
        stop: jest.Mock;
        benchmark: jest.Mock;
      };
    };

    electron.getHandle('nexus:ai:controller:health')({}, { refresh: true });
    electron.getHandle('nexus:ai:controller:start')({}, { modelPath: '/models/coder.gguf', gpuPreference: 'cpu' });
    electron.getHandle('nexus:ai:controller:stop')({}, { force: true });
    electron.getHandle('nexus:ai:controller:benchmark')({}, { iterations: 4 });

    expect(controller.__mock.getHealth).toHaveBeenCalledWith({ refresh: true });
    expect(controller.__mock.start).toHaveBeenCalledWith({
      modelPath: '/models/coder.gguf',
      host: undefined,
      port: undefined,
      threads: undefined,
      contextSize: undefined,
      batchSize: undefined,
      gpuPreference: 'cpu',
      gpuLayers: undefined,
      restartOnCrash: undefined,
      extraArgs: undefined
    });
    expect(controller.__mock.stop).toHaveBeenCalledWith({ force: true });
    expect(controller.__mock.benchmark).toHaveBeenCalledWith({ iterations: 4, warmupIterations: undefined });
  });

  it('routes AI model registry IPC calls through the model registry service', async () => {
    const registry = jest.requireMock('./ai/llama-model-registry-service') as {
      __mock: {
        listModels: jest.Mock;
        importModel: jest.Mock;
      };
    };

    electron.getHandle('nexus:ai:model:list')({}, { refresh: true });
    electron.getHandle('nexus:ai:model:import')({}, { sourcePath: '/models', mode: 'copy', label: 'DeepSeek' });

    expect(registry.__mock.listModels).toHaveBeenCalledWith({ refresh: true });
    expect(registry.__mock.importModel).toHaveBeenCalledWith({
      sourcePath: '/models',
      mode: 'copy',
      label: 'DeepSeek'
    });
  });

  it('routes privacy IPC calls through the privacy service', async () => {
    const privacy = jest.requireMock('./system/privacy-service') as {
      __mock: {
        getSnapshot: jest.Mock;
        updateConsent: jest.Mock;
        exportData: jest.Mock;
        deleteData: jest.Mock;
      };
    };

    const getHandler = electron.getHandle('nexus:privacy:get-consent');
    const updateHandler = electron.getHandle('nexus:privacy:update-consent');
    const exportHandler = electron.getHandle('nexus:privacy:export-data');
    const deleteHandler = electron.getHandle('nexus:privacy:delete-data');

    getHandler({}, { workspaceId: 'workspace-1' });
    updateHandler({}, {
      scope: 'workspace',
      workspaceId: 'workspace-1',
      preferences: {
        usageTelemetry: false,
        crashReports: true
      }
    });
    exportHandler({}, { workspaceId: 'workspace-1', mode: 'workspace' });
    deleteHandler({}, { deleteExports: true });

    expect(privacy.__mock.getSnapshot).toHaveBeenCalledWith('workspace-1');
    expect(privacy.__mock.updateConsent).toHaveBeenCalledWith({
      scope: 'workspace',
      workspaceId: 'workspace-1',
      preferences: {
        usageTelemetry: false,
        crashReports: true
      }
    });
    expect(privacy.__mock.exportData).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      mode: 'workspace'
    });
    expect(privacy.__mock.deleteData).toHaveBeenCalledWith({ deleteExports: true });
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
