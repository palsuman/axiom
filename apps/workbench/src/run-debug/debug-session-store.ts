import type {
  DebugSessionEvent,
  DebugSessionSnapshot,
  DebugSessionStartPayload,
  DebugSessionStopPayload,
  DebugSessionStopResponse
} from '@nexus/contracts/ipc';

type DebugBridge = {
  debugStart(payload?: DebugSessionStartPayload): Promise<DebugSessionSnapshot>;
  debugStop(payload?: DebugSessionStopPayload): Promise<DebugSessionStopResponse>;
  onDebugEvent(listener: (event: DebugSessionEvent) => void): () => void;
};

export type DebugSessionStoreSnapshot = {
  session?: DebugSessionSnapshot;
  loading: boolean;
  error?: string;
  lastEvent?: DebugSessionEvent;
  output: string[];
};

type Listener = (snapshot: DebugSessionStoreSnapshot) => void;

const OUTPUT_BUFFER_LIMIT = 200;

export class DebugSessionStore {
  private readonly listeners = new Set<Listener>();
  private readonly bridge?: DebugBridge;
  private readonly unsubscribeDebugEvent?: () => void;

  private snapshot: DebugSessionStoreSnapshot = {
    loading: false,
    output: []
  };

  constructor(bridge?: DebugBridge) {
    this.bridge = bridge ?? DebugSessionStore.resolveBridge();
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
      const session = await this.bridge.debugStart(payload);
      this.snapshot = {
        ...this.snapshot,
        loading: false,
        session,
        error: undefined
      };
      this.emitChange();
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
                reason: this.snapshot.session.reason
              }
            : this.snapshot.session,
        error: undefined
      };
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

  getSnapshot(): DebugSessionStoreSnapshot {
    return {
      ...this.snapshot,
      session: this.snapshot.session ? cloneSession(this.snapshot.session) : undefined,
      lastEvent: this.snapshot.lastEvent ? cloneEvent(this.snapshot.lastEvent) : undefined,
      output: [...this.snapshot.output]
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

    this.snapshot = {
      ...this.snapshot,
      loading: false,
      session: event.snapshot ? cloneSession(event.snapshot) : this.snapshot.session,
      lastEvent: cloneEvent(event),
      output,
      error: event.kind === 'error' ? event.message ?? this.snapshot.error : this.snapshot.error
    };
    this.emitChange();
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
