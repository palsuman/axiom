import type {
  CopyEntriesPayload,
  CreateEntryPayload,
  DeleteEntriesPayload,
  FsOperationResponse,
  MoveEntriesPayload,
  RenameEntryPayload
} from '@nexus/contracts/ipc';
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
    fsCreateEntry: jest.fn().mockResolvedValue(resolved),
    fsRenameEntry: jest.fn().mockResolvedValue(resolved),
    fsMoveEntries: jest.fn().mockResolvedValue(resolved),
    fsCopyEntries: jest.fn().mockResolvedValue(resolved),
    fsDeleteEntries: jest.fn().mockResolvedValue(resolved),
    fsUndo: jest.fn().mockResolvedValue(true),
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
  };
}

describe('ExplorerActions', () => {
  it('mutates optimistic paths while operations are pending', async () => {
    const store = new MockStore();
    const bridge = createBridge();
    const actions = new ExplorerActions(store as unknown as any, bridge);
    const payload: CreateEntryPayload = { path: '/repo/file.ts', kind: 'file' };
    await actions.createEntry(payload);
    expect(store.addOptimisticPaths).toHaveBeenCalledWith(['/repo/file.ts']);
    expect(store.clearOptimisticPaths).toHaveBeenCalledWith(['/repo/file.ts']);
    expect(bridge.fsCreateEntry).toHaveBeenCalledWith(payload);
  });

  it('clears optimistic state when operations fail', async () => {
    const store = new MockStore();
    const bridge = createBridge();
    bridge.fsDeleteEntries.mockRejectedValueOnce(new Error('failure'));
    const actions = new ExplorerActions(store as unknown as any, bridge);
    const payload: DeleteEntriesPayload = { paths: ['/repo/file.ts'] };
    await expect(actions.deleteEntries(payload)).rejects.toThrow('failure');
    expect(store.addOptimisticPaths).toHaveBeenCalledWith(['/repo/file.ts']);
    expect(store.clearOptimisticPaths).toHaveBeenCalledWith(['/repo/file.ts']);
  });

  it('supports undo', async () => {
    const store = new MockStore();
    const bridge = createBridge();
    const actions = new ExplorerActions(store as unknown as any, bridge);
    await actions.undo('token-123');
    expect(bridge.fsUndo).toHaveBeenCalledWith({ token: 'token-123' });
  });

  it('throws when bridge is missing', () => {
    const store = new MockStore();
    expect(() => new ExplorerActions(store as unknown as any, undefined as any)).toThrow(/bridge/);
  });
});
