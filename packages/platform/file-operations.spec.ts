import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { FileOperationContext } from './file-operations';
import { FileOperationsEngine } from './file-operations';

describe('FileOperationsEngine', () => {
  let tempDir: string;
  let workspace: string;
  let ctx: FileOperationContext;
  let engine: FileOperationsEngine;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-fs-'));
    workspace = path.join(tempDir, 'workspace');
    await fs.mkdir(workspace, { recursive: true });
    ctx = { roots: [workspace] };
    engine = new FileOperationsEngine({ trashDir: path.join(tempDir, 'trash'), undoTtlMs: 1000 });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('creates files and supports undo', async () => {
    const target = path.join(workspace, 'README.md');
    const result = await engine.createEntry(ctx, { path: target, kind: 'file', contents: '# hello' });
    expect(await readFile(target)).toContain('# hello');
    expect(result.undoToken).toBeDefined();
    const undone = await engine.undo(result.undoToken!);
    expect(undone).toBe(true);
    await expect(fs.access(target)).rejects.toThrow();
  });

  it('renames entries and rolls back on undo', async () => {
    const source = path.join(workspace, 'src', 'main.ts');
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.writeFile(source, 'console.log("hi")');
    const destination = path.join(workspace, 'src', 'main-renamed.ts');
    const result = await engine.renameEntry(ctx, { source, target: destination });
    await expect(fs.access(source)).rejects.toThrow();
    expect(await readFile(destination)).toContain('console.log');
    expect(await engine.undo(result.undoToken!)).toBe(true);
    expect(await readFile(source)).toContain('console.log');
  });

  it('copies directories and cleans up via undo', async () => {
    const folder = path.join(workspace, 'assets');
    await fs.mkdir(folder);
    await fs.writeFile(path.join(folder, 'logo.txt'), 'logo');
    const targetDir = path.join(workspace, 'copies');
    const result = await engine.copyEntries(ctx, { sources: [folder], targetDirectory: targetDir });
    const copied = path.join(targetDir, 'assets', 'logo.txt');
    expect(await readFile(copied)).toBe('logo');
    expect(await engine.undo(result.undoToken!)).toBe(true);
    await expect(fs.access(copied)).rejects.toThrow();
  });

  it('moves multiple entries', async () => {
    const fileA = path.join(workspace, 'a.txt');
    const fileB = path.join(workspace, 'b.txt');
    await fs.writeFile(fileA, 'A');
    await fs.writeFile(fileB, 'B');
    const destA = path.join(workspace, 'moved', 'a.txt');
    const destB = path.join(workspace, 'moved', 'b.txt');
    const result = await engine.moveEntries(ctx, {
      entries: [
        { source: fileA, target: destA },
        { source: fileB, target: destB }
      ]
    });
    expect(await readFile(destA)).toBe('A');
    expect(await readFile(destB)).toBe('B');
    await engine.undo(result.undoToken!);
    expect(await readFile(fileA)).toBe('A');
    expect(await readFile(fileB)).toBe('B');
  });

  it('deletes and restores entries via trash', async () => {
    const filePath = path.join(workspace, 'temp.txt');
    await fs.writeFile(filePath, 'temp');
    const result = await engine.deleteEntries(ctx, { paths: [filePath] });
    await expect(fs.access(filePath)).rejects.toThrow();
    expect(await engine.undo(result.undoToken!)).toBe(true);
    expect(await readFile(filePath)).toBe('temp');
  });

  it('rejects paths outside of workspace', async () => {
    await expect(
      engine.createEntry(ctx, { path: path.join(tempDir, 'escape.txt'), kind: 'file' })
    ).rejects.toThrow(/outside the current workspace/);
  });

  it('returns false for unknown undo tokens', async () => {
    expect(await engine.undo('unknown')).toBe(false);
  });

  async function readFile(target: string) {
    const buffer = await fs.readFile(target, 'utf8');
    return buffer.toString();
  }
});
