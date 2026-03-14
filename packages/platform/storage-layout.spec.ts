import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { NexusEnv } from './env';
import { ensureStorageLayout } from './storage-layout';

describe('ensureStorageLayout', () => {
  let tmpRoot: string;
  let homedirSpy: jest.SpyInstance<string, []>;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-storage-'));
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(tmpRoot);
  });

  afterEach(() => {
    homedirSpy?.mockRestore();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('creates directories and metadata when none exist', () => {
    const env = buildEnv(path.join(tmpRoot, '.nexus-new'));
    const result = ensureStorageLayout(env);
    expect(fs.existsSync(env.nexusHome)).toBe(true);
    expect(fs.existsSync(env.nexusDataDir)).toBe(true);
    expect(fs.existsSync(env.workspaceDataDir)).toBe(true);
    expect(result.migrations).toHaveLength(0);
    const metadata = JSON.parse(fs.readFileSync(path.join(tmpRoot, '.nexus-meta.json'), 'utf8'));
    expect(metadata.lastHome).toBe(env.nexusHome);
    expect(metadata.lastWorkspaceDataDir).toBe(env.workspaceDataDir);
  });

  it('migrates existing directories when env paths change', () => {
    const oldHome = path.join(tmpRoot, '.nexus-old');
    const newHome = path.join(tmpRoot, '.nexus-new');
    fs.mkdirSync(path.join(oldHome, 'logs'), { recursive: true });
    fs.writeFileSync(path.join(oldHome, 'logs', 'crash.log'), 'old crash data', 'utf8');
    const metaPath = path.join(tmpRoot, '.nexus-meta.json');
    fs.writeFileSync(
      metaPath,
      JSON.stringify({ lastHome: oldHome, lastDataDir: oldHome, lastWorkspaceDataDir: path.join(oldHome, 'workspaces') }, null, 2),
      'utf8'
    );
    const env = buildEnv(newHome);
    const result = ensureStorageLayout(env);
    const migratedLog = path.join(newHome, 'logs', 'crash.log');
    expect(fs.existsSync(migratedLog)).toBe(true);
    expect(result.migrations.some(record => record.status === 'migrated')).toBe(true);
    const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    expect(metadata.lastHome).toBe(newHome);
  });
});

function buildEnv(homeDir: string): NexusEnv {
  return {
    nexusEnv: 'development',
    logLevel: 'info',
    defaultLocale: 'en-US',
    nexusHome: homeDir,
    nexusDataDir: homeDir,
    workspaceDataDir: path.join(homeDir, 'workspaces'),
    updateChannel: 'stable',
    updateFeedUrl: undefined,
    autoUpdateEnabled: false
  };
}
