import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

jest.mock('xterm', () => ({
  Terminal: jest.fn().mockImplementation(() => ({
    cols: 80,
    rows: 24,
    loadAddon: jest.fn(),
    open: jest.fn(),
    onData: jest.fn(),
    write: jest.fn(),
    writeln: jest.fn(),
    dispose: jest.fn(),
    setOption: jest.fn()
  }))
}));

jest.mock('xterm-addon-fit', () => ({
  FitAddon: jest.fn().mockImplementation(() => ({
    fit: jest.fn()
  }))
}));

function createNexusBridge() {
  return {
    openWorkspace: jest.fn().mockResolvedValue(undefined),
    getRecentWorkspaces: jest.fn().mockResolvedValue([]),
    pickWorkspaceFolder: jest.fn().mockResolvedValue({}),
    telemetryTrack: jest.fn().mockResolvedValue({
      sequence: 1,
      recordedAt: Date.now(),
      name: 'workbench.runtime.started',
      scope: 'renderer',
      level: 'info',
      attributes: {},
      measurements: {},
      tags: []
    }),
    telemetryReplay: jest.fn().mockResolvedValue({
      records: [],
      totalBuffered: 0,
      dropped: 0,
      bufferPath: '/tmp/telemetry/events.jsonl'
    }),
    telemetryGetHealth: jest.fn().mockResolvedValue({
      bufferPath: '/tmp/telemetry/events.jsonl',
      eventCount: 0,
      fileBytes: 0,
      dropped: 0,
      lastSequence: 0,
      oldestRecordedAt: undefined,
      newestRecordedAt: undefined,
      levels: { error: 0, warn: 0, info: 0, debug: 0 },
      scopes: { main: 0, renderer: 0, preload: 0, shared: 0 }
    }),
    privacyGetConsent: jest.fn().mockResolvedValue({
      workspaceId: 'spec-workspace',
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
        workspaceId: 'spec-workspace',
        source: 'default',
        preferences: {
          usageTelemetry: true,
          crashReports: false
        }
      },
      effective: {
        scope: 'workspace',
        workspaceId: 'spec-workspace',
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
    }),
    privacyUpdateConsent: jest.fn(),
    privacyExportData: jest.fn().mockResolvedValue({
      path: '/tmp/privacy/export.json',
      recordCount: 0,
      exportedAt: Date.now(),
      mode: 'all'
    }),
    privacyDeleteData: jest.fn().mockResolvedValue({
      deleted: true,
      clearedRecords: 0,
      bufferPath: '/tmp/telemetry/events.jsonl'
    }),
    featureFlagsList: jest.fn().mockResolvedValue({
      flags: [],
      activeKeys: [],
      summary: '',
      sources: [],
      unknownFlags: [],
      loadErrors: []
    }),
    aiControllerGetHealth: jest.fn().mockResolvedValue({
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
    aiControllerStart: jest.fn(),
    aiControllerStop: jest.fn(),
    aiControllerBenchmark: jest.fn().mockResolvedValue({
      iterations: 3,
      warmupIterations: 1,
      endpoint: 'http://127.0.0.1:39281/health',
      samples: [],
      summary: {
        successes: 0,
        failures: 3
      }
    }),
    fsCreateEntry: jest.fn().mockResolvedValue({ paths: [] }),
    fsRenameEntry: jest.fn().mockResolvedValue({ paths: [] }),
    fsMoveEntries: jest.fn().mockResolvedValue({ paths: [] }),
    fsCopyEntries: jest.fn().mockResolvedValue({ paths: [] }),
    fsDeleteEntries: jest.fn().mockResolvedValue({ paths: [] }),
    fsUndo: jest.fn().mockResolvedValue(true),
    runConfigLoad: jest.fn().mockResolvedValue({
      path: '/tmp/workspace/.nexus/launch.json',
      exists: false,
      text: '{\n  "version": "1.0.0",\n  "configurations": []\n}',
      issues: []
    }),
    runConfigSave: jest.fn().mockResolvedValue({
      path: '/tmp/workspace/.nexus/launch.json',
      saved: true,
      text: '{\n  "version": "1.0.0",\n  "configurations": []\n}',
      issues: []
    }),
    debugStart: jest.fn(),
    debugStop: jest.fn(),
    debugEvaluate: jest.fn().mockResolvedValue({
      sessionId: 'debug-1',
      expression: 'process.pid',
      result: '12345',
      type: 'number'
    }),
    onDebugEvent: jest.fn().mockReturnValue(() => undefined),
    gitListRepositories: jest.fn().mockResolvedValue([]),
    gitGetStatus: jest.fn().mockResolvedValue({
      repositoryId: 'repo-1',
      worktreePath: '/tmp/repo-1',
      branch: 'main',
      upstream: 'origin/main',
      ahead: 0,
      behind: 0,
      detached: false,
      entries: [],
      timestamp: Date.now()
    }),
    gitStage: jest.fn().mockResolvedValue({
      repositoryId: 'repo-1',
      worktreePath: '/tmp/repo-1',
      entries: [],
      timestamp: Date.now()
    }),
    gitUnstage: jest.fn().mockResolvedValue({
      repositoryId: 'repo-1',
      worktreePath: '/tmp/repo-1',
      entries: [],
      timestamp: Date.now()
    }),
    gitGetDiff: jest.fn().mockResolvedValue({
      repositoryId: 'repo-1',
      path: 'src/app.ts',
      staged: false,
      diff: '',
      summary: { additions: 0, deletions: 0 }
    }),
    gitCommit: jest.fn().mockResolvedValue({
      repositoryId: 'repo-1',
      commit: {
        sha: 'abc',
        summary: 'test',
        authorName: 'dev',
        authorEmail: 'dev@example.com',
        authorDate: Date.now()
      }
    }),
    gitGetHistory: jest.fn().mockResolvedValue({ repositoryId: 'repo-1', entries: [] }),
    terminalCreate: jest.fn().mockResolvedValue({
      terminalId: 'term-1',
      pid: 1234,
      shell: '/bin/zsh',
      cwd: '/tmp/repo-1'
    }),
    terminalWrite: jest.fn().mockResolvedValue(undefined),
    terminalResize: jest.fn().mockResolvedValue(undefined),
    terminalDispose: jest.fn().mockResolvedValue(undefined),
    onTerminalData: jest.fn().mockReturnValue(() => undefined),
    onTerminalExit: jest.fn().mockReturnValue(() => undefined)
  };
}

describe('workbench shell bootstrap', () => {
  const tmpRoot = path.join(os.tmpdir(), 'nexus-workbench-main-spec-');
  const globalWindow = globalThis as typeof globalThis & { window?: Window & typeof globalThis };
  const globalScope = globalThis as typeof globalThis;
  let workspaceDir: string;
  const originalWorkspaceData = process.env.NEXUS_WORKSPACE_DATA;
  const originalWorkspaceId = process.env.NEXUS_WORKSPACE_ID;
  const originalNexusHome = process.env.NEXUS_HOME;
  const originalWindow = globalWindow.window;
  const originalSelf = (globalScope as { self?: unknown }).self;

  beforeAll(() => {
    workspaceDir = fs.mkdtempSync(tmpRoot);
    process.env.NEXUS_WORKSPACE_DATA = workspaceDir;
    process.env.NEXUS_WORKSPACE_ID = 'spec-workspace';
    process.env.NEXUS_HOME = workspaceDir;
    (globalScope as { self?: unknown }).self = globalThis;
    globalWindow.window = { nexus: createNexusBridge() } as unknown as Window & typeof globalThis;
  });

  afterAll(() => {
    if (originalWorkspaceData === undefined) {
      delete process.env.NEXUS_WORKSPACE_DATA;
    } else {
      process.env.NEXUS_WORKSPACE_DATA = originalWorkspaceData;
    }
    if (originalWorkspaceId === undefined) {
      delete process.env.NEXUS_WORKSPACE_ID;
    } else {
      process.env.NEXUS_WORKSPACE_ID = originalWorkspaceId;
    }
    if (originalNexusHome === undefined) {
      delete process.env.NEXUS_HOME;
    } else {
      process.env.NEXUS_HOME = originalNexusHome;
    }
    fs.rmSync(workspaceDir, { recursive: true, force: true });
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalWindow, 'window');
    } else {
      globalWindow.window = originalWindow;
    }
    if (originalSelf === undefined) {
      Reflect.deleteProperty(globalScope as Record<string, unknown>, 'self');
    } else {
      (globalScope as { self?: unknown }).self = originalSelf;
    }
  });

  it('registers default layout when imported', async () => {
    jest.resetModules();
    const module = await import('./main').catch(error => {
      throw error instanceof Error ? error : new Error(String(error));
    });
    const snapshot = module.shell.layoutSnapshot();
    expect(snapshot.activityBar.items.length).toBeGreaterThan(0);
    expect(snapshot.sidebar.views.length).toBeGreaterThan(0);
    expect(snapshot.panel.views.length).toBeGreaterThan(0);
    const persistedFiles = fs.readdirSync(workspaceDir);
    expect(persistedFiles.some(name => name.includes('spec-workspace'))).toBe(true);
    const commands = module.commandRegistry.list();
    expect(commands.length).toBeGreaterThan(0);
    await module.commandRegistry.executeCommand('nexus.panel.toggle');
    const afterToggle = module.shell.layoutSnapshot();
    expect(afterToggle.panel.visible).toBe(snapshot.panel.visible ? false : true);
    const paletteResults = await module.commandPalette.search('');
    expect(Array.isArray(paletteResults.items)).toBe(true);
    expect(module.settingsService.get('files.encoding')).toBe('utf8');
    await expect(module.commandRegistry.executeCommand('nexus.status.encoding')).resolves.toBe('utf8');
    await module.commandRegistry.executeCommand('nexus.locale.switch', { locale: 'fr-FR' });
    expect(module.settingsService.get('workbench.locale')).toBe('fr-FR');
    expect(module.i18nService.getLocale()).toBe('fr-FR');
    const translatedPalette = await module.commandPalette.search('palette');
    expect(translatedPalette.items.some((item: { label: string }) => item.label.includes('Afficher'))).toBe(true);
    const settingsSnapshot = await module.commandRegistry.executeCommand('nexus.settings.open', {
      scope: 'user',
      mode: 'form'
    });
    expect((settingsSnapshot as { editorResource: string }).editorResource).toBe('settings://user/form');
    const privacySnapshot = await module.commandRegistry.executeCommand('nexus.privacy.center.open');
    expect((privacySnapshot as { editorResource: string }).editorResource).toBe('privacy://center');
    const jsonSnapshot = await module.commandRegistry.executeCommand('nexus.settings.editor.json', {
      scope: 'user',
      text: JSON.stringify({ 'editor.tabSize': 6 }, null, 2)
    });
    expect((jsonSnapshot as { jsonText: string }).jsonText).toContain('"editor.tabSize": 6');
    expect(module.settingsEditorService.getSnapshot().jsonText).toContain('"editor.tabSize": 6');
    const settingsItems = await module.commandPalette.search('settings');
    expect(settingsItems.items.some((item: { id: string }) => item.id.startsWith('settings:'))).toBe(true);
    const runSnapshot = await module.commandRegistry.executeCommand('nexus.run.configurations.open', {
      mode: 'form'
    });
    expect((runSnapshot as { editorResource: string }).editorResource).toBe('run-config://form');
    const runItems = await module.commandPalette.search('launch');
    expect(runItems.items.some((item: { id: string }) => item.id.startsWith('run-config:'))).toBe(true);
    expect(typeof globalWindow.window?.nexus?.aiControllerGetHealth).toBe('function');
  });
});
