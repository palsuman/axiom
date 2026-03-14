import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { NexusEnv } from '../config/env';

export type StorageMigrationTarget = 'home' | 'data' | 'workspace';

export type StorageMigrationRecord = {
  timestamp: string;
  target: StorageMigrationTarget;
  from: string;
  to: string;
  status: 'migrated' | 'skipped';
  reason?: string;
};

export type StorageLayoutResult = {
  metadataPath: string;
  migrationLogPath: string;
  migrations: StorageMigrationRecord[];
};

type StorageMetadata = {
  lastHome?: string;
  lastDataDir?: string;
  lastWorkspaceDataDir?: string;
};

type StorageLayoutOptions = {
  logger?: (message: string) => void;
};

const METADATA_FILENAME = '.nexus-meta.json';

export function ensureStorageLayout(env: NexusEnv, options: StorageLayoutOptions = {}): StorageLayoutResult {
  const metadataPath = path.join(os.homedir(), METADATA_FILENAME);
  const migrationLogPath = path.join(env.nexusHome, 'meta', 'storage-migrations.log');
  const metadata = readMetadata(metadataPath);
  const migrations = [
    maybeMigrate('home', metadata.lastHome, env.nexusHome, options.logger),
    maybeMigrate('data', metadata.lastDataDir, env.nexusDataDir, options.logger),
    maybeMigrate('workspace', metadata.lastWorkspaceDataDir, env.workspaceDataDir, options.logger)
  ].filter((record): record is StorageMigrationRecord => Boolean(record));

  // Ensure directories exist after any migrations.
  [env.nexusHome, env.nexusDataDir, env.workspaceDataDir].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

  if (migrations.length) {
    appendMigrationLog(migrationLogPath, migrations);
  }

  writeMetadata(metadataPath, {
    lastHome: env.nexusHome,
    lastDataDir: env.nexusDataDir,
    lastWorkspaceDataDir: env.workspaceDataDir
  });

  return { metadataPath, migrationLogPath, migrations };
}

function maybeMigrate(
  target: StorageMigrationTarget,
  previousPath: string | undefined,
  nextPath: string,
  logger?: (message: string) => void
): StorageMigrationRecord | null {
  if (!previousPath || normalize(previousPath) === normalize(nextPath)) {
    return null;
  }
  if (!fs.existsSync(previousPath)) {
    return buildRecord(target, previousPath, nextPath, 'skipped', 'source-missing');
  }
  ensureParentDir(nextPath);
  if (fs.existsSync(nextPath)) {
    if (!isDirEmpty(nextPath)) {
      return buildRecord(target, previousPath, nextPath, 'skipped', 'destination-not-empty');
    }
    fs.rmSync(nextPath, { recursive: true, force: true });
  }
  try {
    logger?.(`[storage] migrating ${target} data from ${previousPath} to ${nextPath}`);
    moveDirectory(previousPath, nextPath);
    return buildRecord(target, previousPath, nextPath, 'migrated');
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown-error';
    return buildRecord(target, previousPath, nextPath, 'skipped', reason);
  }
}

function moveDirectory(source: string, destination: string) {
  try {
    fs.renameSync(source, destination);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EXDEV') {
      fs.cpSync(source, destination, { recursive: true });
      fs.rmSync(source, { recursive: true, force: true });
    } else {
      throw error;
    }
  }
}

function ensureParentDir(dir: string) {
  fs.mkdirSync(path.dirname(dir), { recursive: true });
}

function isDirEmpty(dir: string) {
  try {
    const entries = fs.readdirSync(dir);
    return entries.length === 0;
  } catch {
    return true;
  }
}

function readMetadata(filePath: string): StorageMetadata {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as StorageMetadata;
    }
    return {};
  } catch {
    return {};
  }
}

function writeMetadata(filePath: string, metadata: StorageMetadata) {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2), 'utf8');
}

function appendMigrationLog(filePath: string, migrations: StorageMigrationRecord[]) {
  if (!migrations.length) return;
  ensureParentDir(filePath);
  const lines = migrations.map(migration => JSON.stringify(migration)).join('\n');
  fs.appendFileSync(filePath, `${lines}\n`, 'utf8');
}

function buildRecord(
  target: StorageMigrationTarget,
  from: string,
  to: string,
  status: 'migrated' | 'skipped',
  reason?: string
): StorageMigrationRecord {
  return {
    timestamp: new Date().toISOString(),
    target,
    from: normalize(from),
    to: normalize(to),
    status,
    reason
  };
}

function normalize(value: string) {
  return path.resolve(value);
}
