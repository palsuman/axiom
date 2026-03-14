import { WorkspaceHotExitService } from './workspace-hot-exit-service';
import { TextModelManager, type DocumentStorageAdapter, type DocumentContent } from '../editor/text-model-manager';
import type { WorkspaceBackupSnapshot, WorkspaceBackupSavePayload } from '@nexus/contracts/ipc';

class MemoryStorage implements DocumentStorageAdapter {
  private readonly store = new Map<string, DocumentContent>();
  async read(uri: string): Promise<DocumentContent> {
    const entry = this.store.get(uri);
    if (!entry) {
      throw new Error('missing');
    }
    return entry;
  }
  async write(uri: string, content: DocumentContent): Promise<void> {
    this.store.set(uri, content);
  }
}

class MockTerminalHost {
  public restored?: string;
  onBufferChange() {
    return () => undefined;
  }
  captureSnapshot() {
    return null;
  }
  restoreFromSnapshot(snapshot: { buffer?: string }) {
    this.restored = snapshot.buffer ?? '';
  }
}

describe('WorkspaceHotExitService', () => {
  it('restores documents and terminal buffer from snapshot', async () => {
    const storage = new MemoryStorage();
    const manager = new TextModelManager({ storage, autosaveMode: 'off' });
    const mockHost = new MockTerminalHost();
    const bridge = createBridge({
      workspaceId: 'spec',
      version: 1,
      updatedAt: Date.now(),
      bytes: 200,
      documents: [
        {
          uri: '/tmp/app.ts',
          value: 'console.log(1);',
          dirty: true
        }
      ],
      terminals: [
        {
          terminalId: 't',
          buffer: 'npm start\n'
        }
      ],
      runConfigs: []
    });
    const service = new WorkspaceHotExitService({
      workspaceId: 'spec',
      modelManager: manager,
      terminalHost: mockHost as any,
      bridge,
      debounceMs: 0
    });
    await service.whenReady();
    const snapshot = manager.getSnapshot('/tmp/app.ts');
    expect(snapshot.value).toContain('console.log');
    expect(snapshot.dirty).toBe(true);
    expect(mockHost.restored).toContain('npm start');
    service.dispose();
  });

  it('saves and clears snapshots based on dirty state', async () => {
    const storage = new MemoryStorage();
    const manager = new TextModelManager({ storage, autosaveMode: 'off' });
    await manager.openDocument({ uri: '/tmp/file.ts', initialValue: '', persistent: true });
    const saveMock = jest.fn().mockResolvedValue(null);
    const clearMock = jest.fn().mockResolvedValue(true);
    const bridge = {
      saveSnapshot: (payload: WorkspaceBackupSavePayload) => {
        saveMock(payload);
        return Promise.resolve({
          workspaceId: payload.workspaceId,
          version: 1,
          updatedAt: Date.now(),
          bytes: 100,
          documents: payload.snapshot.documents,
          terminals: [],
          runConfigs: []
        } satisfies WorkspaceBackupSnapshot);
      },
      loadSnapshot: () => Promise.resolve(null),
      clearSnapshot: (payload: { workspaceId: string }) => {
        clearMock(payload);
        return Promise.resolve(true);
      }
    };
    const service = new WorkspaceHotExitService({
      workspaceId: 'spec-two',
      modelManager: manager,
      bridge,
      debounceMs: 0
    });
    await service.whenReady();
    manager.updateDocumentContent('/tmp/file.ts', 'draft');
    await service.flushNow();
    expect(saveMock).toHaveBeenCalled();
    await manager.saveDocument('/tmp/file.ts');
    await service.flushNow();
    expect(clearMock).toHaveBeenCalledWith({ workspaceId: 'spec-two' });
    service.dispose();
  });
});

function createBridge(snapshot: WorkspaceBackupSnapshot) {
  return {
    saveSnapshot: jest.fn().mockResolvedValue(snapshot),
    loadSnapshot: jest.fn().mockResolvedValue(snapshot),
    clearSnapshot: jest.fn().mockResolvedValue(true)
  };
}
