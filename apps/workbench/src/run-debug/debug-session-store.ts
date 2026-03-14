import type {
  DebugBreakpointPayload,
  DebugEvaluatePayload,
  DebugSessionEvent,
  DebugSessionSnapshot,
  DebugSessionStartPayload,
  DebugSessionStopPayload,
  DebugSessionStopResponse
} from '@nexus/contracts/ipc';
import {
  DebugSessionUiStore,
  type DebugBreakpointEntry,
  type DebugSessionUiState,
  type DebugWatchExpression
} from './debug-session-ui-store';

type DebugBridge = {
  debugStart(payload?: DebugSessionStartPayload): Promise<DebugSessionSnapshot>;
  debugStop(payload?: DebugSessionStopPayload): Promise<DebugSessionStopResponse>;
  debugEvaluate?(payload: DebugEvaluatePayload): Promise<{ result: string; type?: string }>;
  onDebugEvent(listener: (event: DebugSessionEvent) => void): () => void;
};

export type DebugSessionStoreSnapshot = {
  session?: DebugSessionSnapshot;
  loading: boolean;
  error?: string;
  lastEvent?: DebugSessionEvent;
  output: string[];
  breakpoints: DebugBreakpointEntry[];
  watchExpressions: DebugWatchExpression[];
  selectedStackFrameId?: number;
};

export type DebugSessionStoreOptions = {
  bridge?: DebugBridge;
  workspaceId?: string;
  dataRoot?: string;
};

type Listener = (snapshot: DebugSessionStoreSnapshot) => void;

const OUTPUT_BUFFER_LIMIT = 200;
const EMPTY_UI_STATE: DebugSessionUiState = {
  breakpoints: [],
  watchExpressions: []
};

export class DebugSessionStore {
  private readonly listeners = new Set<Listener>();
  private readonly bridge?: DebugBridge;
  private readonly uiStore?: DebugSessionUiStore;
  private readonly unsubscribeDebugEvent?: () => void;

  private watchEvaluationRequestId = 0;

  private snapshot: DebugSessionStoreSnapshot = {
    loading: false,
    output: [],
    breakpoints: [],
    watchExpressions: []
  };

  constructor(options: DebugBridge | DebugSessionStoreOptions = {}) {
    const normalized = normalizeOptions(options);
    this.bridge = normalized.bridge ?? DebugSessionStore.resolveBridge();
    this.uiStore = normalized.workspaceId
      ? new DebugSessionUiStore({
          workspaceId: normalized.workspaceId,
          dataRoot: normalized.dataRoot
        })
      : undefined;

    this.hydrateUiState();

    if (this.bridge?.onDebugEvent) {
      this.unsubscribeDebugEvent = this.bridge.onDebugEvent(event => this.handleDebugEvent(event));
    }
  }

  async start(payload: DebugSessionStartPayload = {}) {
    if (!this.bridge) {
      throw new Error('Debug bridge is unavailable');
    }

    this.snapshot = {
      ...this.snapshot,
      loading: true,
      error: undefined
    };
    this.emitChange();

    try {
      const session = await this.bridge.debugStart({
        ...payload,
        breakpoints: buildBreakpointPayload(this.snapshot.breakpoints)
      });
      this.snapshot = {
        ...this.snapshot,
        loading: false,
        session,
        selectedStackFrameId: resolveSelectedStackFrameId(this.snapshot.selectedStackFrameId, session),
        error: undefined
      };
      this.persistUiState();
      this.emitChange();
      void this.refreshWatchExpressions();
      return this.getSnapshot();
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        loading: false,
        error: this.readError(error)
      };
      this.emitChange();
      throw error;
    }
  }

  async stop(payload: DebugSessionStopPayload = {}) {
    if (!this.bridge) {
      throw new Error('Debug bridge is unavailable');
    }
    this.snapshot = {
      ...this.snapshot,
      loading: true,
      error: undefined
    };
    this.emitChange();

    try {
      const result = await this.bridge.debugStop(payload);
      this.snapshot = {
        ...this.snapshot,
        loading: false,
        session:
          this.snapshot.session && this.snapshot.session.sessionId === result.sessionId
            ? {
                ...this.snapshot.session,
                state: result.state,
                reason: this.snapshot.session.reason,
                stackFrames: []
              }
            : this.snapshot.session,
        watchExpressions: resetWatchExpressions(this.snapshot.watchExpressions),
        selectedStackFrameId: undefined,
        error: undefined
      };
      this.persistUiState();
      this.emitChange();
      return result;
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        loading: false,
        error: this.readError(error)
      };
      this.emitChange();
      throw error;
    }
  }

  addBreakpoint(source: string, line: number) {
    const normalizedSource = source.trim();
    const normalizedLine = Number(line);
    if (!normalizedSource) {
      throw new Error('Breakpoint source is required');
    }
    if (!Number.isInteger(normalizedLine) || normalizedLine <= 0) {
      throw new Error('Breakpoint line must be a positive integer');
    }

    const existing = this.snapshot.breakpoints.find(
      breakpoint => breakpoint.source === normalizedSource && breakpoint.line === normalizedLine
    );
    const breakpoints = existing
      ? this.snapshot.breakpoints.map(breakpoint =>
          breakpoint.id === existing.id ? { ...breakpoint, enabled: true } : breakpoint
        )
      : [
          ...this.snapshot.breakpoints,
          {
            id: createDebugUiId('bp'),
            source: normalizedSource,
            line: normalizedLine,
            enabled: true
          }
        ];

    return this.commitUiState({
      breakpoints
    });
  }

  toggleBreakpoint(id: string, enabled?: boolean) {
    const breakpoints = this.snapshot.breakpoints.map(breakpoint =>
      breakpoint.id === id
        ? {
            ...breakpoint,
            enabled: typeof enabled === 'boolean' ? enabled : !breakpoint.enabled
          }
        : breakpoint
    );
    return this.commitUiState({ breakpoints });
  }

  toggleBreakpointAtLocation(source: string, line: number) {
    const normalizedSource = source.trim();
    const normalizedLine = Number(line);
    const existing = this.snapshot.breakpoints.find(
      breakpoint => breakpoint.source === normalizedSource && breakpoint.line === normalizedLine
    );
    if (!existing) {
      return this.addBreakpoint(normalizedSource, normalizedLine);
    }
    return this.toggleBreakpoint(existing.id);
  }

  removeBreakpoint(id: string) {
    const breakpoints = this.snapshot.breakpoints.filter(breakpoint => breakpoint.id !== id);
    return this.commitUiState({ breakpoints });
  }

  addWatchExpression(expression: string) {
    const normalizedExpression = expression.trim();
    if (!normalizedExpression) {
      throw new Error('Watch expression is required');
    }

    if (
      this.snapshot.watchExpressions.some(watch => watch.expression.toLowerCase() === normalizedExpression.toLowerCase())
    ) {
      return this.getSnapshot();
    }

    return this.commitUiState({
      watchExpressions: [
        ...this.snapshot.watchExpressions,
        {
          id: createDebugUiId('watch'),
          expression: normalizedExpression,
          status: 'idle'
        }
      ]
    });
  }

  updateWatchExpression(id: string, expression: string) {
    const normalizedExpression = expression.trim();
    if (!normalizedExpression) {
      throw new Error('Watch expression is required');
    }
    const watchExpressions: DebugWatchExpression[] = this.snapshot.watchExpressions.map(watch =>
      watch.id === id
        ? {
            ...watch,
            expression: normalizedExpression,
            status: 'idle' as const,
            value: undefined,
            type: undefined,
            error: undefined
          }
        : watch
    );
    return this.commitUiState({ watchExpressions });
  }

  removeWatchExpression(id: string) {
    return this.commitUiState({
      watchExpressions: this.snapshot.watchExpressions.filter(watch => watch.id !== id)
    });
  }

  selectStackFrame(frameId?: number) {
    const selectedStackFrameId = resolveSelectedStackFrameId(frameId, this.snapshot.session);
    this.snapshot = {
      ...this.snapshot,
      selectedStackFrameId
    };
    this.persistUiState();
    this.emitChange();
    void this.refreshWatchExpressions();
    return this.getSnapshot();
  }

  getSnapshot(): DebugSessionStoreSnapshot {
    return {
      ...this.snapshot,
      session: this.snapshot.session ? cloneSession(this.snapshot.session) : undefined,
      lastEvent: this.snapshot.lastEvent ? cloneEvent(this.snapshot.lastEvent) : undefined,
      output: [...this.snapshot.output],
      breakpoints: this.snapshot.breakpoints.map(cloneBreakpoint),
      watchExpressions: this.snapshot.watchExpressions.map(cloneWatchExpression)
    };
  }

  onDidChange(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose() {
    this.unsubscribeDebugEvent?.();
    this.listeners.clear();
  }

  private handleDebugEvent(event: DebugSessionEvent) {
    const output = [...this.snapshot.output];
    if (event.kind === 'output' && event.output?.output) {
      output.push(event.output.output);
      if (output.length > OUTPUT_BUFFER_LIMIT) {
        output.splice(0, output.length - OUTPUT_BUFFER_LIMIT);
      }
    }

    const session = event.snapshot ? cloneSession(event.snapshot) : this.snapshot.session;
    const selectedStackFrameId =
      session?.state === 'stopped'
        ? resolveSelectedStackFrameId(this.snapshot.selectedStackFrameId, session)
        : undefined;

    this.snapshot = {
      ...this.snapshot,
      loading: false,
      session,
      selectedStackFrameId,
      lastEvent: cloneEvent(event),
      output,
      watchExpressions:
        session?.state === 'stopped'
          ? this.snapshot.watchExpressions
          : resetWatchExpressions(this.snapshot.watchExpressions),
      error: event.kind === 'error' ? event.message ?? this.snapshot.error : this.snapshot.error
    };
    this.persistUiState();
    this.emitChange();

    if (session?.state === 'stopped') {
      void this.refreshWatchExpressions();
    }
  }

  private async refreshWatchExpressions() {
    const requestId = ++this.watchEvaluationRequestId;
    const session = this.snapshot.session;
    const selectedFrameId = resolveSelectedStackFrameId(this.snapshot.selectedStackFrameId, session);

    if (!session || session.state !== 'stopped' || !this.snapshot.watchExpressions.length || !this.bridge?.debugEvaluate) {
      this.snapshot = {
        ...this.snapshot,
        selectedStackFrameId: selectedFrameId,
        watchExpressions: resetWatchExpressions(this.snapshot.watchExpressions)
      };
      this.persistUiState();
      this.emitChange();
      return;
    }

    this.snapshot = {
      ...this.snapshot,
      selectedStackFrameId: selectedFrameId,
      watchExpressions: this.snapshot.watchExpressions.map(watch => ({
        ...watch,
        status: 'evaluating',
        error: undefined
      }))
    };
    this.emitChange();

    const watchExpressions = await Promise.all(
      this.snapshot.watchExpressions.map(async watch => {
        try {
          const response = await this.bridge!.debugEvaluate!({
            sessionId: session.sessionId,
            frameId: selectedFrameId,
            expression: watch.expression,
            context: 'watch'
          });
          return {
            ...watch,
            status: 'evaluated' as const,
            value: response.result,
            type: response.type,
            error: undefined
          };
        } catch (error) {
          return {
            ...watch,
            status: 'error' as const,
            value: undefined,
            type: undefined,
            error: this.readError(error)
          };
        }
      })
    );

    if (requestId !== this.watchEvaluationRequestId) {
      return;
    }

    this.snapshot = {
      ...this.snapshot,
      watchExpressions
    };
    this.persistUiState();
    this.emitChange();
  }

  private commitUiState(
    updates: Partial<Pick<DebugSessionStoreSnapshot, 'breakpoints' | 'watchExpressions' | 'selectedStackFrameId'>>
  ) {
    this.snapshot = {
      ...this.snapshot,
      ...updates
    };
    this.persistUiState();
    this.emitChange();
    void this.refreshWatchExpressions();
    return this.getSnapshot();
  }

  private hydrateUiState() {
    const persisted = this.uiStore?.load() ?? EMPTY_UI_STATE;
    this.snapshot = {
      ...this.snapshot,
      breakpoints: persisted.breakpoints.map(cloneBreakpoint),
      watchExpressions: persisted.watchExpressions.map(watch => ({
        ...cloneWatchExpression(watch),
        status: 'idle',
        value: undefined,
        type: undefined,
        error: undefined
      })),
      selectedStackFrameId: persisted.selectedStackFrameId
    };
  }

  private persistUiState() {
    this.uiStore?.save({
      breakpoints: this.snapshot.breakpoints.map(cloneBreakpoint),
      watchExpressions: this.snapshot.watchExpressions.map(cloneWatchExpression),
      selectedStackFrameId: this.snapshot.selectedStackFrameId
    });
  }

  private emitChange() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }

  private readError(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private static resolveBridge(): DebugBridge | undefined {
    if (typeof window !== 'undefined' && window.nexus) {
      return window.nexus;
    }
    return undefined;
  }
}

function normalizeOptions(options: DebugBridge | DebugSessionStoreOptions): DebugSessionStoreOptions {
  if (isDebugBridge(options)) {
    return {
      bridge: options
    };
  }
  return options;
}

function isDebugBridge(candidate: DebugBridge | DebugSessionStoreOptions): candidate is DebugBridge {
  return (
    typeof (candidate as DebugBridge).debugStart === 'function' &&
    typeof (candidate as DebugBridge).debugStop === 'function' &&
    typeof (candidate as DebugBridge).onDebugEvent === 'function'
  );
}

function cloneSession(session: DebugSessionSnapshot): DebugSessionSnapshot {
  return {
    ...session,
    stackFrames: session.stackFrames.map(frame => ({
      ...frame,
      source: frame.source ? { ...frame.source } : undefined
    }))
  };
}

function cloneEvent(event: DebugSessionEvent): DebugSessionEvent {
  return {
    ...event,
    snapshot: event.snapshot ? cloneSession(event.snapshot) : undefined,
    output: event.output ? { ...event.output } : undefined
  };
}

function cloneBreakpoint(breakpoint: DebugBreakpointEntry): DebugBreakpointEntry {
  return {
    ...breakpoint
  };
}

function cloneWatchExpression(watch: DebugWatchExpression): DebugWatchExpression {
  return {
    ...watch
  };
}

function buildBreakpointPayload(breakpoints: readonly DebugBreakpointEntry[]): DebugBreakpointPayload[] {
  const grouped = new Map<string, number[]>();
  breakpoints.forEach(breakpoint => {
    if (!breakpoint.enabled) {
      return;
    }
    const lines = grouped.get(breakpoint.source) ?? [];
    lines.push(breakpoint.line);
    grouped.set(breakpoint.source, lines);
  });
  return Array.from(grouped.entries()).map(([source, lines]) => ({
    source,
    lines: Array.from(new Set(lines)).sort((left, right) => left - right)
  }));
}

function resolveSelectedStackFrameId(frameId: number | undefined, session?: DebugSessionSnapshot) {
  if (!session?.stackFrames.length) {
    return undefined;
  }
  if (typeof frameId === 'number' && session.stackFrames.some(frame => frame.id === frameId)) {
    return frameId;
  }
  return session.stackFrames[0]?.id;
}

function resetWatchExpressions(watchExpressions: readonly DebugWatchExpression[]): DebugWatchExpression[] {
  return watchExpressions.map(watch => ({
    ...watch,
    status: 'idle',
    value: undefined,
    type: undefined,
    error: undefined
  }));
}

function createDebugUiId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
