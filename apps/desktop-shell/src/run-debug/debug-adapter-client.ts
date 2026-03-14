import EventEmitter from 'node:events';
import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process';

import {
  DebugProtocolMessageParser,
  serializeDebugProtocolMessage,
  type DebugProtocolEvent,
  type DebugProtocolRequest,
  type DebugProtocolResponse
} from '@nexus/platform/run-debug/debug-adapter-protocol';

export type DebugAdapterExecutable = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

type SpawnFactory = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio
) => ChildProcessWithoutNullStreams;

type PendingRequest = {
  command: string;
  resolve: (value: DebugProtocolResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export declare interface DebugAdapterClient {
  on(event: 'event', listener: (event: DebugProtocolEvent) => void): this;
  on(event: 'stderr', listener: (output: string) => void): this;
  on(event: 'close', listener: (payload: { code: number | null; signal: NodeJS.Signals | null }) => void): this;
}

export class DebugAdapterClient extends EventEmitter {
  private readonly parser = new DebugProtocolMessageParser();
  private readonly pending = new Map<number, PendingRequest>();
  private readonly spawnFactory: SpawnFactory;
  private process?: ChildProcessWithoutNullStreams;
  private requestSequence = 1;

  constructor(private readonly executable: DebugAdapterExecutable, spawnFactory: SpawnFactory = spawn) {
    super();
    this.spawnFactory = spawnFactory;
  }

  async start() {
    if (this.process) {
      return;
    }
    if (!this.executable.command) {
      throw new Error('Debug adapter command is required');
    }

    const processHandle = this.spawnFactory(this.executable.command, this.executable.args ?? [], {
      cwd: this.executable.cwd,
      env: this.executable.env,
      stdio: 'pipe'
    });
    this.process = processHandle;

    processHandle.stdout.on('data', chunk => {
      const messages = this.parser.push(chunk);
      messages.forEach(message => this.handleMessage(message));
    });

    processHandle.stderr.on('data', chunk => {
      const output = chunk.toString('utf8');
      if (output.trim()) {
        this.emit('stderr', output);
      }
    });

    processHandle.on('close', (code, signal) => {
      this.rejectPendingRequests(new Error(`Debug adapter process exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`));
      this.emit('close', { code, signal });
      this.process = undefined;
    });

    processHandle.on('error', error => {
      this.rejectPendingRequests(error);
    });
  }

  async request(command: string, args?: Record<string, unknown>, timeoutMs = 10_000): Promise<DebugProtocolResponse> {
    if (!this.process) {
      throw new Error('Debug adapter process is not started');
    }

    const request: DebugProtocolRequest = {
      seq: this.requestSequence,
      type: 'request',
      command,
      arguments: args
    };
    this.requestSequence += 1;

    const response = await new Promise<DebugProtocolResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(request.seq);
        reject(new Error(`Debug adapter request timed out: ${command}`));
      }, timeoutMs);
      this.pending.set(request.seq, {
        command,
        resolve,
        reject,
        timeout
      });
      this.writeMessage(request);
    });

    if (!response.success) {
      throw new Error(response.message || `Debug adapter request failed: ${command}`);
    }

    return response;
  }

  dispose() {
    this.rejectPendingRequests(new Error('Debug adapter client disposed'));
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
    this.process = undefined;
  }

  private writeMessage(message: DebugProtocolRequest) {
    if (!this.process) {
      throw new Error('Debug adapter process is not available');
    }
    this.process.stdin.write(serializeDebugProtocolMessage(message));
  }

  private handleMessage(message: DebugProtocolEvent | DebugProtocolResponse | DebugProtocolRequest) {
    if (message.type === 'event') {
      this.emit('event', message);
      return;
    }
    if (message.type === 'response') {
      const pending = this.pending.get(message.request_seq);
      if (!pending) {
        return;
      }
      this.pending.delete(message.request_seq);
      clearTimeout(pending.timeout);
      pending.resolve(message);
    }
  }

  private rejectPendingRequests(error: Error) {
    if (!this.pending.size) {
      return;
    }
    const pending = Array.from(this.pending.values());
    this.pending.clear();
    pending.forEach(request => {
      clearTimeout(request.timeout);
      request.reject(new Error(`${request.command}: ${error.message}`));
    });
  }
}
