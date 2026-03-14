import path from 'node:path';
import type { WebContents } from 'electron';

import type {
  CopyEntriesPayload,
  CreateEntryPayload,
  DeleteEntriesPayload,
  FsOperationResponse,
  MoveEntriesPayload,
  RenameEntryPayload,
  UndoPayload
} from '@nexus/contracts/ipc';
import { FileOperationsEngine, type FileOperationContext } from '@nexus/platform/file-operations';
import type { NexusEnv } from '@nexus/platform/env';

import type { WindowManager } from './window-manager';

export class FileOperationsService {
  private readonly engine: FileOperationsEngine;

  constructor(private readonly env: NexusEnv, private readonly windows: WindowManager) {
    this.engine = new FileOperationsEngine({
      trashDir: path.join(env.workspaceDataDir, 'trash')
    });
  }

  create(sender: WebContents, payload: CreateEntryPayload): Promise<FsOperationResponse> {
    return this.engine.createEntry(this.resolveContext(sender), payload);
  }

  rename(sender: WebContents, payload: RenameEntryPayload): Promise<FsOperationResponse> {
    return this.engine.renameEntry(this.resolveContext(sender), payload);
  }

  move(sender: WebContents, payload: MoveEntriesPayload): Promise<FsOperationResponse> {
    return this.engine.moveEntries(this.resolveContext(sender), payload);
  }

  copy(sender: WebContents, payload: CopyEntriesPayload): Promise<FsOperationResponse> {
    return this.engine.copyEntries(this.resolveContext(sender), payload);
  }

  delete(sender: WebContents, payload: DeleteEntriesPayload): Promise<FsOperationResponse> {
    return this.engine.deleteEntries(this.resolveContext(sender), payload);
  }

  undo(_sender: WebContents, payload: UndoPayload): Promise<boolean> {
    return this.engine.undo(payload.token);
  }

  private resolveContext(sender: WebContents): FileOperationContext {
    const session = this.windows.getSessionMetadataForWebContents(sender.id);
    if (!session) {
      throw new Error('Unable to resolve workspace for file operation');
    }
    const roots =
      (session.workspaceRoots && session.workspaceRoots.length ? session.workspaceRoots : undefined) ??
      (session.workspace ? [session.workspace] : undefined);
    if (!roots || !roots.length) {
      throw new Error('No workspace roots registered for this window');
    }
    return { roots };
  }
}
