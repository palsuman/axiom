import fs from 'node:fs';
import path from 'node:path';
import type {
  WorkspaceBackupContent,
  WorkspaceBackupSnapshot,
  WorkspaceBackupWriteResult
} from '@nexus/contracts/ipc';
import { resolveWorkspaceDataRoot, sanitizeWorkspaceId } from './workspace-paths';

const BACKUP_VERSION = 1;
const DEFAULT_MAX_BYTES = 500 * 1024 * 1024;
const DEFAULT_DOCUMENT_LIMIT = 4 * 1024 * 1024; // 4 MB per document before pruning.
const DEFAULT_TERMINAL_BUFFER_LIMIT = 512 * 1024; // 512 KB per terminal buffer.
const SNAPSHOT_FILENAME = 'snapshot.json';

export type WorkspaceBackupManagerOptions = {
  dataRoot?: string;
  maxBytes?: number;
};

export class WorkspaceBackupManager {
  private readonly baseDir: string;
  private readonly maxBytes: number;

  constructor(options: WorkspaceBackupManagerOptions = {}) {
    this.baseDir = path.join(resolveWorkspaceDataRoot(options.dataRoot), 'backups');
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  }

  save(workspaceId: string, content: WorkspaceBackupContent): WorkspaceBackupWriteResult {
    if (!workspaceId) {
      throw new Error('workspaceId is required for backup');
    }
    const sanitized = sanitizeWorkspaceId(workspaceId);
    const targetDir = path.join(this.baseDir, sanitized);
    fs.mkdirSync(targetDir, { recursive: true });
    const { snapshot, bytes, truncated } = this.buildSnapshot(sanitized, content);
    const filePath = path.join(targetDir, SNAPSHOT_FILENAME);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
    return {
      workspaceId: sanitized,
      bytes,
      documents: snapshot.documents.length,
      terminals: snapshot.terminals.length,
      runConfigs: snapshot.runConfigs.length,
      truncated
    };
  }

  load(workspaceId: string): WorkspaceBackupSnapshot | null {
    if (!workspaceId) return null;
    const sanitized = sanitizeWorkspaceId(workspaceId);
    const filePath = path.join(this.baseDir, sanitized, SNAPSHOT_FILENAME);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as WorkspaceBackupSnapshot;
      if (parsed.version !== BACKUP_VERSION) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  clear(workspaceId: string) {
    if (!workspaceId) return false;
    const sanitized = sanitizeWorkspaceId(workspaceId);
    const dir = path.join(this.baseDir, sanitized);
    if (!fs.existsSync(dir)) {
      return false;
    }
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  }

  private buildSnapshot(workspaceId: string, rawContent: WorkspaceBackupContent) {
    const normalized = this.normalizeContent(rawContent);
    let truncated = false;
    const snapshot: WorkspaceBackupSnapshot = {
      workspaceId,
      version: BACKUP_VERSION,
      updatedAt: Date.now(),
      bytes: 0,
      ...normalized
    };
    let serialized = JSON.stringify(snapshot);
    let bytes = Buffer.byteLength(serialized, 'utf8');
    const mutable: WorkspaceBackupSnapshot = {
      ...snapshot,
      documents: snapshot.documents.map(entry => ({ ...entry })),
      terminals: snapshot.terminals.map(entry => ({ ...entry })),
      runConfigs: [...snapshot.runConfigs]
    };
    while (bytes > this.maxBytes && (mutable.documents.length || mutable.terminals.length || mutable.runConfigs.length)) {
      truncated = true;
      if (mutable.documents.length) {
        mutable.documents.pop();
      } else if (mutable.terminals.length) {
        const terminal = mutable.terminals[mutable.terminals.length - 1];
        if (terminal.buffer && terminal.buffer.length > 1024) {
          terminal.buffer = truncateString(terminal.buffer, Math.floor(terminal.buffer.length / 2));
        } else {
          mutable.terminals.pop();
        }
      } else if (mutable.runConfigs.length) {
        mutable.runConfigs.pop();
      } else {
        break;
      }
      serialized = JSON.stringify(mutable);
      bytes = Buffer.byteLength(serialized, 'utf8');
    }
    mutable.bytes = bytes;
    return { snapshot: mutable as WorkspaceBackupSnapshot, bytes, truncated };
  }

  private normalizeContent(content: WorkspaceBackupContent): WorkspaceBackupContent {
    return {
      documents: (content.documents ?? []).map(entry => ({
        ...entry,
        value: truncateString(entry.value ?? '', DEFAULT_DOCUMENT_LIMIT)
      })),
      terminals: (content.terminals ?? []).map(entry => ({
        ...entry,
        buffer: entry.buffer ? truncateString(entry.buffer, DEFAULT_TERMINAL_BUFFER_LIMIT) : undefined
      })),
      runConfigs: content.runConfigs ?? []
    };
  }
}

function truncateString(value: string, limit: number) {
  if (!value) return '';
  const byteLength = Buffer.byteLength(value, 'utf8');
  if (byteLength <= limit) {
    return value;
  }
  const targetBytes = Math.max(0, limit - 3);
  let total = 0;
  let index = value.length - 1;
  while (index >= 0 && total < targetBytes) {
    const charCode = value.charCodeAt(index);
    total += charCode > 0x7f ? 2 : 1;
    index -= 1;
  }
  const sliceStart = Math.max(0, value.length - (value.length - index - 1));
  const trimmed = value.slice(sliceStart);
  return trimmed.length < value.length ? `…${trimmed}` : trimmed;
}
