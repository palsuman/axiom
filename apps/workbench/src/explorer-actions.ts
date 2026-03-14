import type {
  CopyEntriesPayload,
  CreateEntryPayload,
  DeleteEntriesPayload,
  FsOperationResponse,
  MoveEntriesPayload,
  RenameEntryPayload
} from '@nexus/contracts/ipc';
import type { ExplorerStore } from './explorer-store';

type FsBridge = NonNullable<Window['nexus']>;

export class ExplorerActions {
  private readonly bridge: FsBridge;

  constructor(private readonly store: ExplorerStore, bridge?: FsBridge) {
    const resolvedBridge = bridge ?? (typeof window !== 'undefined' ? window.nexus : undefined);
    if (!resolvedBridge) {
      throw new Error('Explorer bridge is unavailable');
    }
    this.bridge = resolvedBridge;
  }

  async createEntry(payload: CreateEntryPayload) {
    return this.withOptimistic([payload.path], () => this.bridge.fsCreateEntry(payload));
  }

  async renameEntry(payload: RenameEntryPayload) {
    const pending = [payload.source, payload.target];
    return this.withOptimistic(pending, () => this.bridge.fsRenameEntry(payload));
  }

  async moveEntries(payload: MoveEntriesPayload) {
    const pending = payload.entries.flatMap(item => [item.source, item.target]);
    return this.withOptimistic(pending, () => this.bridge.fsMoveEntries(payload));
  }

  async copyEntries(payload: CopyEntriesPayload) {
    const pending = [payload.targetDirectory];
    return this.withOptimistic(pending, () => this.bridge.fsCopyEntries(payload));
  }

  async deleteEntries(payload: DeleteEntriesPayload) {
    return this.withOptimistic(payload.paths, () => this.bridge.fsDeleteEntries(payload));
  }

  async undo(token: string) {
    return this.bridge.fsUndo({ token });
  }

  private async withOptimistic(paths: string[], operation: () => Promise<FsOperationResponse>) {
    this.store.addOptimisticPaths(paths);
    try {
      const result = await operation();
      return result;
    } finally {
      this.store.clearOptimisticPaths(paths);
    }
  }
}
