import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type {
  CopyEntriesPayload,
  CreateEntryPayload,
  DeleteEntriesPayload,
  FsOperationResponse,
  MoveEntriesPayload,
  RenameEntryPayload
} from '@nexus/contracts/ipc';

export interface FileOperationContext {
  roots: readonly string[];
}

type UndoEntry = {
  token: string;
  perform: () => Promise<void>;
  dispose?: () => Promise<void>;
  expiresAt: number;
};

type NormalizedRoots = readonly string[];

const DEFAULT_UNDO_TTL_MS = 5 * 60 * 1000;

export class FileOperationsEngine {
  private readonly trashDir: string;
  private readonly undoStore = new Map<string, UndoEntry>();
  private readonly undoTtlMs: number;

  constructor(options: { trashDir: string; undoTtlMs?: number }) {
    this.trashDir = path.resolve(options.trashDir);
    this.undoTtlMs = options.undoTtlMs ?? DEFAULT_UNDO_TTL_MS;
  }

  async createEntry(ctx: FileOperationContext, payload: CreateEntryPayload): Promise<FsOperationResponse> {
    this.assertContext(ctx);
    this.purgeExpiredUndos();
    const normalized = this.normalizeRoots(ctx.roots);
    const absolutePath = this.assertWithinRoots(payload.path, normalized);
    await this.ensureParentDirectory(absolutePath);
    if (payload.kind === 'folder') {
      await fs.mkdir(absolutePath, { recursive: false });
    } else {
      await fs.writeFile(absolutePath, payload.contents ?? '', { flag: 'wx' });
    }
    const undoToken = this.registerUndo(async () => {
      await this.removePath(absolutePath);
    });
    return { paths: [absolutePath], undoToken };
  }

  async renameEntry(ctx: FileOperationContext, payload: RenameEntryPayload): Promise<FsOperationResponse> {
    return this.moveEntries(ctx, {
      entries: [{ source: payload.source, target: payload.target }],
      overwrite: payload.overwrite
    });
  }

  async moveEntries(ctx: FileOperationContext, payload: MoveEntriesPayload): Promise<FsOperationResponse> {
    this.assertContext(ctx);
    this.purgeExpiredUndos();
    if (!payload.entries.length) {
      return { paths: [] };
    }
    const normalized = this.normalizeRoots(ctx.roots);
    const operations = payload.entries.map(entry => ({
      source: this.assertWithinRoots(entry.source, normalized),
      target: this.assertWithinRoots(entry.target, normalized)
    }));
    operations.forEach(op => this.assertNoSelfContainment(op.source, op.target));
    for (const op of operations) {
      await this.ensureParentDirectory(op.target);
      if (payload.overwrite) {
        await this.removeIfExists(op.target);
      } else {
        await this.assertNotExists(op.target);
      }
    }
    const applied: typeof operations = [];
    try {
      for (const op of operations) {
        await fs.rename(op.source, op.target);
        applied.push(op);
      }
    } catch (error) {
      await this.rollbackMoves(applied);
      throw error;
    }
    const undoToken = this.registerUndo(async () => {
      for (const op of applied.slice().reverse()) {
        await this.ensureParentDirectory(op.source);
        await this.removeIfExists(op.source);
        await fs.rename(op.target, op.source);
      }
    });
    return { paths: applied.map(op => op.target), undoToken };
  }

  async copyEntries(ctx: FileOperationContext, payload: CopyEntriesPayload): Promise<FsOperationResponse> {
    this.assertContext(ctx);
    this.purgeExpiredUndos();
    if (!payload.sources.length) {
      return { paths: [] };
    }
    const normalized = this.normalizeRoots(ctx.roots);
    const targetDir = this.assertWithinRoots(payload.targetDirectory, normalized);
    await fs.mkdir(targetDir, { recursive: true });
    const createdPaths: string[] = [];
    try {
      for (const sourceInput of payload.sources) {
        const source = this.assertWithinRoots(sourceInput, normalized);
        const destination = path.join(targetDir, path.basename(source));
        if (payload.overwrite) {
          await this.removeIfExists(destination);
        } else {
          await this.assertNotExists(destination);
        }
        await fs.cp(source, destination, {
          recursive: true,
          force: !!payload.overwrite,
          errorOnExist: !payload.overwrite
        });
        createdPaths.push(destination);
      }
    } catch (error) {
      await this.rollbackCopies(createdPaths);
      throw error;
    }
    const undoToken = this.registerUndo(async () => {
      await this.rollbackCopies(createdPaths);
    });
    return { paths: createdPaths, undoToken };
  }

  async deleteEntries(ctx: FileOperationContext, payload: DeleteEntriesPayload): Promise<FsOperationResponse> {
    this.assertContext(ctx);
    this.purgeExpiredUndos();
    if (!payload.paths.length) {
      return { paths: [] };
    }
    const normalized = this.normalizeRoots(ctx.roots);
    const trashBatch = path.join(this.trashDir, `${Date.now()}-${randomUUID()}`);
    await fs.mkdir(trashBatch, { recursive: true });
    const relocations: Array<{ source: string; destination: string }> = [];
    try {
      for (const input of payload.paths) {
        const source = this.assertWithinRoots(input, normalized);
        const relative = this.relativeToRoots(source, normalized);
        const destination = path.join(trashBatch, String(relative.rootIndex), relative.relativePath || path.basename(source));
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.rename(source, destination);
        relocations.push({ source, destination });
      }
    } catch (error) {
      await this.rollbackDeletions(relocations);
      throw error;
    }
    const undoToken = this.registerUndo(
      async () => {
        for (const entry of relocations.slice().reverse()) {
          await this.ensureParentDirectory(entry.source);
          await fs.rename(entry.destination, entry.source);
        }
        await this.cleanupTrashDir(trashBatch);
      },
      async () => {
        await this.cleanupTrashDir(trashBatch);
      }
    );
    return { paths: payload.paths.map(p => path.resolve(p)), undoToken };
  }

  async undo(token: string): Promise<boolean> {
    this.purgeExpiredUndos();
    const entry = this.undoStore.get(token);
    if (!entry) {
      return false;
    }
    this.undoStore.delete(token);
    await entry.perform();
    if (entry.dispose) {
      await entry.dispose();
    }
    return true;
  }

  private registerUndo(perform: () => Promise<void>, dispose?: () => Promise<void>) {
    const token = randomUUID();
    this.undoStore.set(token, {
      token,
      perform,
      dispose,
      expiresAt: Date.now() + this.undoTtlMs
    });
    return token;
  }

  private purgeExpiredUndos(now = Date.now()) {
    for (const [token, entry] of this.undoStore.entries()) {
      if (entry.expiresAt <= now) {
        this.undoStore.delete(token);
        if (entry.dispose) {
          entry.dispose().catch(() => undefined);
        }
      }
    }
  }

  private assertContext(ctx: FileOperationContext) {
    if (!ctx.roots?.length) {
      throw new Error('File operations require at least one workspace root');
    }
  }

  private normalizeRoots(roots: readonly string[]): NormalizedRoots {
    if (!roots.length) {
      throw new Error('No workspace roots registered');
    }
    return roots.map(root => path.resolve(root));
  }

  private assertWithinRoots(target: string, roots: readonly string[]): string {
    const resolved = path.resolve(target);
    for (const root of roots) {
      const relative = path.relative(root, resolved);
      if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
        return resolved;
      }
      if (relative === '') {
        return resolved;
      }
    }
    throw new Error(`Path "${target}" is outside the current workspace roots`);
  }

  private relativeToRoots(target: string, roots: NormalizedRoots) {
    const resolved = path.resolve(target);
    for (let index = 0; index < roots.length; index += 1) {
      const root = roots[index];
      const relative = path.relative(root, resolved);
      if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
        return { rootIndex: index, relativePath: relative };
      }
      if (relative === '') {
        return { rootIndex: index, relativePath: '' };
      }
    }
    throw new Error(`Unable to derive relative path for "${target}"`);
  }

  private assertNoSelfContainment(source: string, target: string) {
    const normalizedSource = path.resolve(source);
    const normalizedTarget = path.resolve(target);
    if (
      normalizedSource === normalizedTarget ||
      normalizedTarget.startsWith(`${normalizedSource}${path.sep}`)
    ) {
      throw new Error('Cannot move an entry into itself or its descendants');
    }
  }

  private async ensureParentDirectory(target: string) {
    const parent = path.dirname(target);
    await fs.mkdir(parent, { recursive: true });
  }

  private async pathExists(target: string) {
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  private async assertNotExists(target: string) {
    if (await this.pathExists(target)) {
      throw new Error(`Path already exists: ${target}`);
    }
  }

  private async removeIfExists(target: string) {
    if (await this.pathExists(target)) {
      await this.removePath(target);
    }
  }

  private async removePath(target: string) {
    await fs.rm(target, { recursive: true, force: true });
  }

  private async rollbackMoves(applied: Array<{ source: string; target: string }>) {
    for (const op of applied.slice().reverse()) {
      try {
        await this.ensureParentDirectory(op.source);
        await fs.rename(op.target, op.source);
      } catch {
        // best-effort rollback
      }
    }
  }

  private async rollbackCopies(paths: string[]) {
    for (const destination of paths.reverse()) {
      try {
        await this.removePath(destination);
      } catch {
        // ignore
      }
    }
  }

  private async rollbackDeletions(relocations: Array<{ source: string; destination: string }>) {
    for (const entry of relocations.slice().reverse()) {
      try {
        await this.ensureParentDirectory(entry.source);
        await fs.rename(entry.destination, entry.source);
      } catch {
        // ignore
      }
    }
    const batchRoots = new Set(relocations.map(item => path.dirname(path.dirname(item.destination))));
    for (const batchRoot of batchRoots) {
      await this.cleanupTrashDir(batchRoot);
    }
  }

  private async cleanupTrashDir(dir: string) {
    await this.removePath(dir);
  }
}
