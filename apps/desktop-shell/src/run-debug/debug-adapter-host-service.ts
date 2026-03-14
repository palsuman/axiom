import EventEmitter from 'node:events';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { WebContents } from 'electron';

import type {
  DebugBreakpointPayload,
  DebugSessionEvent,
  DebugSessionSnapshot,
  DebugSessionStartPayload,
  DebugSessionStopPayload,
  DebugSessionStopResponse,
  DebugStackFrame
} from '@nexus/contracts/ipc';
import type { DebugProtocolEvent } from '@nexus/platform/run-debug/debug-adapter-protocol';
import {
  parseLaunchConfigurationDocument,
  type LaunchConfiguration,
  type LaunchConfigurationDocument
} from '@nexus/platform/run-debug/launch-config';

import { DebugAdapterClient, type DebugAdapterExecutable } from './debug-adapter-client';
import { LaunchConfigurationService } from './launch-configuration-service';
import type { WindowManager } from '../windowing/window-manager';

type SessionMetadata = NonNullable<ReturnType<WindowManager['getSessionMetadataForWebContents']>>;

type ManagedDebugSession = {
  workspaceSessionId: string;
  ownerWebContentsId: number;
  snapshot: DebugSessionSnapshot;
  client: DebugAdapterClient;
  terminating: boolean;
};

export type DebugAdapterResolver = (
  configuration: LaunchConfiguration,
  context: { workspaceRoot: string; workspaceSessionId: string; ownerWebContentsId: number }
) => DebugAdapterExecutable;

type ClientFactory = (executable: DebugAdapterExecutable) => DebugAdapterClient;

export declare interface DebugAdapterHostService {
  on(event: 'event', listener: (payload: { ownerId: number; event: DebugSessionEvent }) => void): this;
}

export class DebugAdapterHostService extends EventEmitter {
  private readonly sessions = new Map<string, ManagedDebugSession>();
  private readonly sessionByOwner = new Map<number, string>();
  private readonly adapterResolver: DebugAdapterResolver;
  private readonly clientFactory: ClientFactory;
  private readonly now: () => number;

  constructor(
    private readonly windows: WindowManager,
    private readonly launchConfigurations: LaunchConfigurationService,
    options: {
      adapterResolver?: DebugAdapterResolver;
      clientFactory?: ClientFactory;
      now?: () => number;
    } = {}
  ) {
    super();
    this.adapterResolver = options.adapterResolver ?? defaultAdapterResolver;
    this.clientFactory = options.clientFactory ?? (executable => new DebugAdapterClient(executable));
    this.now = options.now ?? (() => Date.now());
  }

  async start(sender: WebContents, payload: DebugSessionStartPayload): Promise<DebugSessionSnapshot> {
    await this.stopActiveSessionForOwner(sender.id, { terminateDebuggee: true }).catch(() => undefined);

    const metadata = this.resolveSession(sender.id);
    const workspaceRoot = this.resolveWorkspaceRoot(metadata);
    if (!workspaceRoot) {
      throw new Error('Unable to resolve workspace root for debug session');
    }

    const launchDocument = await this.loadLaunchDocument(sender);
    const configuration = selectConfiguration(launchDocument, payload);
    if (!configuration) {
      throw new Error('No launch configuration available for debug session');
    }

    const sessionId = randomUUID();
    const snapshot: DebugSessionSnapshot = {
      sessionId,
      workspaceSessionId: metadata.id,
      ownerWebContentsId: sender.id,
      configurationName: configuration.name,
      adapterType: configuration.type,
      request: configuration.request,
      startedAt: this.now(),
      state: 'starting',
      stackFrames: []
    };

    const executable = this.adapterResolver(configuration, {
      workspaceRoot,
      workspaceSessionId: metadata.id,
      ownerWebContentsId: sender.id
    });
    const client = this.clientFactory(executable);
    const managed: ManagedDebugSession = {
      workspaceSessionId: metadata.id,
      ownerWebContentsId: sender.id,
      snapshot,
      client,
      terminating: false
    };

    this.sessions.set(sessionId, managed);
    this.sessionByOwner.set(sender.id, sessionId);

    client.on('event', event => {
      void this.handleAdapterEvent(managed, event);
    });
    client.on('stderr', output => {
      this.emitDebugEvent(managed, {
        sessionId: managed.snapshot.sessionId,
        kind: 'output',
        output: {
          category: 'console',
          output
        },
        timestamp: this.now(),
        snapshot: cloneSnapshot(managed.snapshot)
      });
    });
    client.on('close', () => {
      if (!managed.terminating && managed.snapshot.state !== 'terminated' && managed.snapshot.state !== 'failed') {
        this.updateSnapshot(managed, {
          state: 'failed',
          reason: 'Debug adapter process exited unexpectedly',
          stackFrames: []
        });
        this.emitDebugEvent(managed, {
          sessionId: managed.snapshot.sessionId,
          kind: 'error',
          message: 'Debug adapter process exited unexpectedly',
          timestamp: this.now(),
          snapshot: cloneSnapshot(managed.snapshot)
        });
      }
      this.cleanupSession(managed.snapshot.sessionId);
    });

    try {
      await client.start();
      await client.request('initialize', {
        clientID: 'nexus',
        clientName: 'Nexus IDE',
        adapterID: configuration.type,
        pathFormat: 'path',
        linesStartAt1: true,
        columnsStartAt1: true,
        supportsRunInTerminalRequest: false
      });
      await this.applyBreakpoints(client, payload.breakpoints);
      await this.startConfiguration(client, configuration, {
        stopOnEntry: payload.stopOnEntry
      });
      await client.request('configurationDone', {});

      this.updateSnapshot(managed, {
        state: 'running',
        reason: undefined,
        threadId: undefined,
        stackFrames: []
      });
      this.emitDebugEvent(managed, {
        sessionId: managed.snapshot.sessionId,
        kind: 'started',
        timestamp: this.now(),
        snapshot: cloneSnapshot(managed.snapshot)
      });

      return cloneSnapshot(managed.snapshot);
    } catch (error) {
      managed.terminating = true;
      this.updateSnapshot(managed, {
        state: 'failed',
        reason: (error as Error).message,
        stackFrames: []
      });
      this.emitDebugEvent(managed, {
        sessionId: managed.snapshot.sessionId,
        kind: 'error',
        message: (error as Error).message,
        timestamp: this.now(),
        snapshot: cloneSnapshot(managed.snapshot)
      });
      client.dispose();
      this.cleanupSession(managed.snapshot.sessionId);
      throw error;
    }
  }

  async stop(sender: WebContents, payload: DebugSessionStopPayload = {}): Promise<DebugSessionStopResponse> {
    const targetSessionId = payload.sessionId ?? this.sessionByOwner.get(sender.id);
    if (!targetSessionId) {
      throw new Error('No active debug session for this window');
    }
    const managed = this.sessions.get(targetSessionId);
    if (!managed) {
      throw new Error(`Debug session ${targetSessionId} not found`);
    }

    await this.stopSessionById(targetSessionId, payload.terminateDebuggee ?? true);

    return {
      sessionId: targetSessionId,
      stopped: true,
      state: 'terminated'
    };
  }

  async stopSessionByWorkspaceSession(workspaceSessionId: string, terminateDebuggee = true) {
    const sessions = Array.from(this.sessions.values()).filter(session => session.workspaceSessionId === workspaceSessionId);
    await Promise.allSettled(sessions.map(session => this.stopSessionById(session.snapshot.sessionId, terminateDebuggee)));
  }

  async stopSessionById(sessionId: string, terminateDebuggee = true) {
    const managed = this.sessions.get(sessionId);
    if (!managed || managed.terminating) {
      return false;
    }

    managed.terminating = true;
    try {
      await managed.client.request('disconnect', { terminateDebuggee }, 3_000);
    } catch {
      // Ignore adapter disconnect failures and force disposal below.
    }

    this.updateSnapshot(managed, {
      state: 'terminated',
      reason: 'Stopped by user',
      stackFrames: []
    });
    this.emitDebugEvent(managed, {
      sessionId: managed.snapshot.sessionId,
      kind: 'terminated',
      timestamp: this.now(),
      snapshot: cloneSnapshot(managed.snapshot)
    });

    managed.client.dispose();
    this.cleanupSession(managed.snapshot.sessionId);
    return true;
  }

  dispose() {
    const activeSessionIds = Array.from(this.sessions.keys());
    activeSessionIds.forEach(sessionId => {
      const session = this.sessions.get(sessionId);
      session?.client.dispose();
      this.cleanupSession(sessionId);
    });
  }

  private async handleAdapterEvent(managed: ManagedDebugSession, event: DebugProtocolEvent) {
    if (managed.terminating) {
      return;
    }

    if (event.event === 'output') {
      const category = readOutputCategory(event.body?.category);
      const output = typeof event.body?.output === 'string' ? event.body.output : '';
      if (output) {
        this.emitDebugEvent(managed, {
          sessionId: managed.snapshot.sessionId,
          kind: 'output',
          output: { category, output },
          timestamp: this.now(),
          snapshot: cloneSnapshot(managed.snapshot)
        });
      }
      return;
    }

    if (event.event === 'stopped') {
      const threadId = typeof event.body?.threadId === 'number' ? event.body.threadId : undefined;
      const reason = typeof event.body?.reason === 'string' ? event.body.reason : 'stopped';
      const stackFrames = await this.fetchStackFrames(managed, threadId);
      this.updateSnapshot(managed, {
        state: 'stopped',
        reason,
        threadId,
        stackFrames
      });
      this.emitDebugEvent(managed, {
        sessionId: managed.snapshot.sessionId,
        kind: 'stopped',
        timestamp: this.now(),
        snapshot: cloneSnapshot(managed.snapshot)
      });
      return;
    }

    if (event.event === 'continued') {
      this.updateSnapshot(managed, {
        state: 'running',
        reason: undefined,
        stackFrames: []
      });
      this.emitDebugEvent(managed, {
        sessionId: managed.snapshot.sessionId,
        kind: 'continued',
        timestamp: this.now(),
        snapshot: cloneSnapshot(managed.snapshot)
      });
      return;
    }

    if (event.event === 'terminated' || event.event === 'exited') {
      if (managed.snapshot.state !== 'terminated') {
        this.updateSnapshot(managed, {
          state: 'terminated',
          reason: event.event === 'exited' ? 'Debug target exited' : 'Debug session terminated',
          stackFrames: []
        });
        this.emitDebugEvent(managed, {
          sessionId: managed.snapshot.sessionId,
          kind: 'terminated',
          timestamp: this.now(),
          snapshot: cloneSnapshot(managed.snapshot)
        });
      }
      managed.terminating = true;
      managed.client.dispose();
      this.cleanupSession(managed.snapshot.sessionId);
    }
  }

  private async fetchStackFrames(managed: ManagedDebugSession, threadId?: number): Promise<DebugStackFrame[]> {
    try {
      let resolvedThreadId = threadId;
      if (!resolvedThreadId) {
        const threadResponse = await managed.client.request('threads', {});
        const threads = Array.isArray(threadResponse.body?.threads)
          ? (threadResponse.body?.threads as Array<Record<string, unknown>>)
          : [];
        resolvedThreadId = typeof threads[0]?.id === 'number' ? (threads[0]?.id as number) : 1;
      }

      const stackResponse = await managed.client.request('stackTrace', {
        threadId: resolvedThreadId,
        startFrame: 0,
        levels: 32
      });
      const stackFrames = Array.isArray(stackResponse.body?.stackFrames)
        ? (stackResponse.body?.stackFrames as Array<Record<string, unknown>>)
        : [];
      return stackFrames
        .map(frame => normalizeStackFrame(frame))
        .filter((frame): frame is DebugStackFrame => Boolean(frame));
    } catch {
      return [];
    }
  }

  private async applyBreakpoints(client: DebugAdapterClient, breakpoints?: DebugBreakpointPayload[]) {
    if (!breakpoints?.length) {
      return;
    }

    for (const breakpoint of breakpoints) {
      if (!breakpoint.source || !breakpoint.lines.length) {
        continue;
      }
      await client.request('setBreakpoints', {
        source: {
          path: breakpoint.source
        },
        breakpoints: breakpoint.lines.map(line => ({ line }))
      });
    }
  }

  private async startConfiguration(
    client: DebugAdapterClient,
    configuration: LaunchConfiguration,
    options: { stopOnEntry?: boolean }
  ) {
    const stopOnEntry = options.stopOnEntry ?? configuration.stopOnEntry ?? false;
    const launchArguments = {
      name: configuration.name,
      type: configuration.type,
      request: configuration.request,
      program: configuration.program,
      cwd: configuration.cwd,
      args: configuration.args ?? [],
      env: configuration.env ?? {},
      stopOnEntry,
      console: configuration.console
    };

    if (configuration.request === 'launch') {
      await client.request('launch', launchArguments);
      return;
    }

    await client.request('attach', launchArguments);
  }

  private async loadLaunchDocument(sender: WebContents) {
    const loaded = await this.launchConfigurations.load(sender);
    const parsed = parseLaunchConfigurationDocument(loaded.text);
    if (parsed.issues.length) {
      throw new Error(`Launch configuration validation failed: ${parsed.issues[0]?.message ?? 'Unknown issue'}`);
    }
    return parsed.document;
  }

  private resolveSession(webContentsId: number) {
    const session = this.windows.getSessionMetadataForWebContents(webContentsId);
    if (!session) {
      throw new Error('Unable to resolve window session for debug session');
    }
    return session;
  }

  private resolveWorkspaceRoot(session: SessionMetadata) {
    return session.workspacePrimary ?? session.workspaceRoots?.[0] ?? session.workspace;
  }

  private cleanupSession(sessionId: string) {
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      return;
    }
    this.sessions.delete(sessionId);
    const active = this.sessionByOwner.get(managed.ownerWebContentsId);
    if (active === sessionId) {
      this.sessionByOwner.delete(managed.ownerWebContentsId);
    }
  }

  private async stopActiveSessionForOwner(ownerWebContentsId: number, options: { terminateDebuggee: boolean }) {
    const sessionId = this.sessionByOwner.get(ownerWebContentsId);
    if (!sessionId) {
      return false;
    }
    return this.stopSessionById(sessionId, options.terminateDebuggee);
  }

  private updateSnapshot(managed: ManagedDebugSession, patch: Partial<DebugSessionSnapshot>) {
    managed.snapshot = {
      ...managed.snapshot,
      ...patch,
      stackFrames: patch.stackFrames ? [...patch.stackFrames] : [...managed.snapshot.stackFrames]
    };
  }

  private emitDebugEvent(managed: ManagedDebugSession, event: DebugSessionEvent) {
    this.emit('event', {
      ownerId: managed.ownerWebContentsId,
      event
    });
  }
}

function normalizeStackFrame(frame: Record<string, unknown>): DebugStackFrame | undefined {
  const id = typeof frame.id === 'number' ? frame.id : undefined;
  const line = typeof frame.line === 'number' ? frame.line : undefined;
  const column = typeof frame.column === 'number' ? frame.column : 1;
  const name = typeof frame.name === 'string' && frame.name.trim() ? frame.name.trim() : 'frame';
  if (!id || !line) {
    return undefined;
  }

  const sourceRecord = frame.source;
  const source =
    sourceRecord && typeof sourceRecord === 'object' && !Array.isArray(sourceRecord)
      ? {
          name:
            typeof (sourceRecord as Record<string, unknown>).name === 'string'
              ? ((sourceRecord as Record<string, unknown>).name as string)
              : undefined,
          path:
            typeof (sourceRecord as Record<string, unknown>).path === 'string'
              ? ((sourceRecord as Record<string, unknown>).path as string)
              : undefined
        }
      : undefined;

  return {
    id,
    name,
    line,
    column,
    source
  };
}

function selectConfiguration(
  document: LaunchConfigurationDocument,
  payload: DebugSessionStartPayload
): LaunchConfiguration | undefined {
  if (payload.configurationName) {
    const byName = document.configurations.find(configuration => configuration.name === payload.configurationName);
    if (byName) {
      return byName;
    }
  }
  if (typeof payload.configurationIndex === 'number') {
    return document.configurations[payload.configurationIndex];
  }
  return document.configurations[0];
}

function readOutputCategory(category: unknown): 'stdout' | 'stderr' | 'console' {
  if (category === 'stdout' || category === 'stderr' || category === 'console') {
    return category;
  }
  return 'console';
}

function cloneSnapshot(snapshot: DebugSessionSnapshot): DebugSessionSnapshot {
  return {
    ...snapshot,
    stackFrames: snapshot.stackFrames.map(frame => ({
      ...frame,
      source: frame.source ? { ...frame.source } : undefined
    }))
  };
}

function defaultAdapterResolver(
  configuration: LaunchConfiguration,
  context: { workspaceRoot: string }
): DebugAdapterExecutable {
  if (configuration.type !== 'node') {
    throw new Error(`Unsupported debug adapter type: ${configuration.type}`);
  }

  const adapterCommand = process.env.NEXUS_NODE_DEBUG_ADAPTER?.trim() || process.execPath;
  const adapterArgs = process.env.NEXUS_NODE_DEBUG_ADAPTER?.trim()
    ? []
    : [path.resolve(__dirname, 'adapters/node-debug-adapter.js')];

  return {
    command: adapterCommand,
    args: adapterArgs,
    cwd: context.workspaceRoot,
    env: {
      ...process.env
    }
  };
}
