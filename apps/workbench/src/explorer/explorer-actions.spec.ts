import type {
  CreateEntryPayload,
  DeleteEntriesPayload,
  FsOperationResponse
} from '@nexus/contracts/ipc';
import type { ExplorerStore } from './explorer-store';
import { ExplorerActions } from './explorer-actions';

class MockStore {
  addOptimisticPaths = jest.fn();
  clearOptimisticPaths = jest.fn();
}

const resolved: FsOperationResponse = { paths: [] };

function createBridge() {
  return {
    openWorkspace: jest.fn(),
    getRecentWorkspaces: jest.fn().mockResolvedValue([]),
    pickWorkspaceFolder: jest.fn(),
    telemetryTrack: jest.fn(),
    telemetryReplay: jest.fn(),
    telemetryGetHealth: jest.fn(),
    privacyGetConsent: jest.fn(),
    privacyUpdateConsent: jest.fn(),
    privacyExportData: jest.fn(),
    privacyDeleteData: jest.fn(),
    featureFlagsList: jest.fn().mockResolvedValue({
      flags: [],
      activeKeys: [],
      summary: '',
      sources: [],
      unknownFlags: [],
      loadErrors: []
    }),
    aiControllerGetHealth: jest.fn(),
    aiControllerStart: jest.fn(),
    aiControllerStop: jest.fn(),
    aiControllerBenchmark: jest.fn(),
    aiModelList: jest.fn(),
    aiModelImport: jest.fn(),
    fsCreateEntry: jest.fn().mockResolvedValue(resolved),
    fsRenameEntry: jest.fn().mockResolvedValue(resolved),
    fsMoveEntries: jest.fn().mockResolvedValue(resolved),
    fsCopyEntries: jest.fn().mockResolvedValue(resolved),
    fsDeleteEntries: jest.fn().mockResolvedValue(resolved),
    fsUndo: jest.fn().mockResolvedValue(true),
    runConfigLoad: jest.fn(),
    runConfigSave: jest.fn(),
    debugStart: jest.fn(),
    debugStop: jest.fn(),
    debugEvaluate: jest.fn(),
    onDebugEvent: jest.fn().mockReturnValue(() => undefined),
    gitListRepositories: jest.fn().mockResolvedValue([]),
    gitGetStatus: jest.fn(),
    gitStage: jest.fn(),
    gitUnstage: jest.fn(),
    gitGetDiff: jest.fn(),
    gitCommit: jest.fn(),
    gitGetHistory: jest.fn(),
    terminalCreate: jest.fn(),
    terminalWrite: jest.fn(),
    terminalResize: jest.fn(),
    terminalDispose: jest.fn(),
    onTerminalData: jest.fn().mockReturnValue(() => undefined),
    onTerminalExit: jest.fn().mockReturnValue(() => undefined)
  } as NonNullable<Window['nexus']>;
}

describe('ExplorerActions', () => {
  it('mutates optimistic paths while operations are pending', async () => {
    const store = new MockStore();
    const bridge = createBridge();
    const actions = new ExplorerActions(store as unknown as ExplorerStore, bridge);
    const payload: CreateEntryPayload = { path: '/repo/file.ts', kind: 'file' };
    await actions.createEntry(payload);
    expect(store.addOptimisticPaths).toHaveBeenCalledWith(['/repo/file.ts']);
    expect(store.clearOptimisticPaths).toHaveBeenCalledWith(['/repo/file.ts']);
    expect(bridge.fsCreateEntry).toHaveBeenCalledWith(payload);
  });

  it('clears optimistic state when operations fail', async () => {
    const store = new MockStore();
    const bridge = createBridge();
    const deleteEntries = bridge.fsDeleteEntries as jest.MockedFunction<NonNullable<Window['nexus']>['fsDeleteEntries']>;
    deleteEntries.mockRejectedValueOnce(new Error('failure'));
    const actions = new ExplorerActions(store as unknown as ExplorerStore, bridge);
    const payload: DeleteEntriesPayload = { paths: ['/repo/file.ts'] };
    await expect(actions.deleteEntries(payload)).rejects.toThrow('failure');
    expect(store.addOptimisticPaths).toHaveBeenCalledWith(['/repo/file.ts']);
    expect(store.clearOptimisticPaths).toHaveBeenCalledWith(['/repo/file.ts']);
  });

  it('supports undo', async () => {
    const store = new MockStore();
    const bridge = createBridge();
    const actions = new ExplorerActions(store as unknown as ExplorerStore, bridge);
    await actions.undo('token-123');
    expect(bridge.fsUndo).toHaveBeenCalledWith({ token: 'token-123' });
  });

  it('throws when bridge is missing', () => {
    const store = new MockStore();
    expect(() => new ExplorerActions(store as unknown as ExplorerStore, undefined)).toThrow(/bridge/);
  });
});
