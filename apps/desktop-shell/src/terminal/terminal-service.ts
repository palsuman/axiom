import EventEmitter from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type {
  TerminalCreatePayload,
  TerminalDescriptor,
  TerminalDisposePayload,
  TerminalResizePayload,
  TerminalWritePayload
} from '@nexus/contracts/ipc';
import type { IPty, IPtyForkOptions } from 'node-pty';
import { spawn } from 'node-pty';

type PtyFactory = (command: string, args: string[], options: IPtyForkOptions) => IPty;

type TerminalRecord = {
  terminalId: string;
  ownerWebContentsId: number;
  sessionId: string;
  shell: string;
  cwd?: string;
  pty?: IPty;
  unavailableMessage?: string;
};

type TerminalDataPayload = {
  terminalId: string;
  ownerId: number;
  data: string;
};

type TerminalExitPayload = {
  terminalId: string;
  ownerId: number;
  code: number;
  signal?: number;
};

export declare interface TerminalService {
  on(event: 'data', listener: (payload: TerminalDataPayload) => void): this;
  on(event: 'exit', listener: (payload: TerminalExitPayload) => void): this;
}

export class TerminalService extends EventEmitter {
  private readonly sessions = new Map<string, TerminalRecord>();

  constructor(private readonly ptyFactory: PtyFactory = spawn) {
    super();
  }

  createTerminal(ownerId: number, sessionId: string, payload: TerminalCreatePayload): TerminalDescriptor {
    const { cols, rows } = payload;
    if (!Number.isFinite(cols) || !Number.isFinite(rows)) {
      throw new Error('Terminal requires finite cols/rows');
    }
    const shellInfo = resolveShell(payload.shell);
    const cwd = payload.cwd ?? process.cwd();
    const env = { ...process.env, ...payload.env };
    const terminalId = randomUUID();
    try {
      const pty = this.ptyFactory(shellInfo.command, shellInfo.args, {
        cwd,
        env,
        cols,
        rows
      });
      const record: TerminalRecord = {
        terminalId,
        ownerWebContentsId: ownerId,
        sessionId,
        shell: shellInfo.command,
        cwd,
        pty
      };
      this.sessions.set(terminalId, record);
      pty.onData(data => {
        this.emit('data', { terminalId, ownerId, data });
      });
      pty.onExit(({ exitCode, signal }) => {
        this.emit('exit', { terminalId, ownerId, code: exitCode, signal });
        this.sessions.delete(terminalId);
      });
      return {
        terminalId,
        pid: pty.pid,
        shell: shellInfo.displayName,
        cwd
      };
    } catch (error) {
      const unavailableMessage = buildUnavailableTerminalMessage(shellInfo.displayName, error);
      const record: TerminalRecord = {
        terminalId,
        ownerWebContentsId: ownerId,
        sessionId,
        shell: shellInfo.command,
        cwd,
        unavailableMessage
      };
      this.sessions.set(terminalId, record);
      queueMicrotask(() => {
        this.emit('data', {
          terminalId,
          ownerId,
          data: unavailableMessage
        });
      });
      return {
        terminalId,
        pid: 0,
        shell: `${shellInfo.displayName} (unavailable)`,
        cwd
      };
    }
  }

  write(payload: TerminalWritePayload) {
    const record = this.sessions.get(payload.terminalId);
    if (!record) {
      throw new Error(`Terminal ${payload.terminalId} not found`);
    }
    if (!record.pty) {
      return;
    }
    record.pty.write(payload.data);
  }

  resize(payload: TerminalResizePayload) {
    const record = this.sessions.get(payload.terminalId);
    if (!record) {
      throw new Error(`Terminal ${payload.terminalId} not found`);
    }
    if (!record.pty) {
      return;
    }
    if (!Number.isFinite(payload.cols) || !Number.isFinite(payload.rows)) {
      return;
    }
    record.pty.resize(Math.max(1, payload.cols), Math.max(1, payload.rows));
  }

  dispose(payload: TerminalDisposePayload) {
    const record = this.sessions.get(payload.terminalId);
    if (!record) return false;
    record.pty?.kill();
    this.sessions.delete(payload.terminalId);
    return true;
  }

  disposeBySession(sessionId: string) {
    for (const record of this.sessions.values()) {
      if (record.sessionId === sessionId) {
        record.pty?.kill();
        this.sessions.delete(record.terminalId);
      }
    }
  }
}

function buildUnavailableTerminalMessage(shell: string, error: unknown) {
  const reason = error instanceof Error ? error.message : String(error);
  return [
    `[terminal unavailable] Failed to start shell: ${shell}`,
    reason,
    '',
    'You can continue using the workbench, but terminal features are disabled in this session.'
  ].join('\r\n');
}

function resolveShell(preferred?: string) {
  if (preferred) {
    const parts = preferred.split(' ');
    return {
      command: parts[0] ?? preferred,
      args: parts.slice(1),
      displayName: preferred
    };
  }
  if (process.platform === 'win32') {
    const shell = firstAvailableCommand([process.env.ComSpec, 'powershell.exe', 'cmd.exe']) ?? 'cmd.exe';
    const args = shell.toLowerCase().includes('powershell') ? ['-NoLogo'] : [];
    return { command: shell, args, displayName: shell };
  }
  const loginShell =
    firstExecutablePath([
      process.env.SHELL,
      safeUserShell(),
      '/bin/zsh',
      '/bin/bash',
      '/bin/sh'
    ]) ?? '/bin/sh';

  return {
    command: loginShell,
    args: ['-l'],
    displayName: loginShell
  };
}

function firstExecutablePath(candidates: Array<string | undefined>) {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value) {
      continue;
    }
    const absolutePath = path.isAbsolute(value) ? value : path.resolve(value);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    try {
      fs.accessSync(absolutePath, fs.constants.X_OK);
      return absolutePath;
    } catch {
      continue;
    }
  }
  return undefined;
}

function firstAvailableCommand(candidates: Array<string | undefined>) {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function safeUserShell() {
  try {
    const userInfo = os.userInfo();
    return 'shell' in userInfo ? (userInfo.shell as string | undefined) : undefined;
  } catch {
    return undefined;
  }
}
