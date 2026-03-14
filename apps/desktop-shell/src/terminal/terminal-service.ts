import EventEmitter from 'node:events';
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
  pty: IPty;
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
  }

  write(payload: TerminalWritePayload) {
    const record = this.sessions.get(payload.terminalId);
    if (!record) {
      throw new Error(`Terminal ${payload.terminalId} not found`);
    }
    record.pty.write(payload.data);
  }

  resize(payload: TerminalResizePayload) {
    const record = this.sessions.get(payload.terminalId);
    if (!record) {
      throw new Error(`Terminal ${payload.terminalId} not found`);
    }
    if (!Number.isFinite(payload.cols) || !Number.isFinite(payload.rows)) {
      return;
    }
    record.pty.resize(Math.max(1, payload.cols), Math.max(1, payload.rows));
  }

  dispose(payload: TerminalDisposePayload) {
    const record = this.sessions.get(payload.terminalId);
    if (!record) return false;
    record.pty.kill();
    this.sessions.delete(payload.terminalId);
    return true;
  }

  disposeBySession(sessionId: string) {
    for (const record of this.sessions.values()) {
      if (record.sessionId === sessionId) {
        record.pty.kill();
        this.sessions.delete(record.terminalId);
      }
    }
  }
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
    const pwsh = process.env.ComSpec ?? 'powershell.exe';
    return { command: pwsh, args: ['-NoLogo'], displayName: pwsh };
  }
  const loginShell = process.env.SHELL || '/bin/bash';
  const resolvedShell = path.resolve(loginShell);
  return { command: resolvedShell, args: ['--login'], displayName: resolvedShell };
}
