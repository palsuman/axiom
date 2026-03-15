import type {
  TerminalCreatePayload,
  TerminalDataEvent,
  TerminalDescriptor,
  TerminalDisposePayload,
  TerminalExitEvent,
  TerminalResizePayload,
  TerminalWritePayload
} from '@nexus/contracts/ipc';
import { resolveNexusBridge } from '../boot/nexus-bridge-resolver';

type TerminalBridge = {
  terminalCreate(payload: TerminalCreatePayload): Promise<TerminalDescriptor>;
  terminalWrite(payload: TerminalWritePayload): Promise<void>;
  terminalResize(payload: TerminalResizePayload): Promise<void>;
  terminalDispose(payload: TerminalDisposePayload): Promise<void>;
  onTerminalData(listener: (event: TerminalDataEvent) => void): () => void;
  onTerminalExit(listener: (event: TerminalExitEvent) => void): () => void;
};

export class TerminalClient {
  private static resolveBridge(): TerminalBridge {
    const bridge = resolveNexusBridge<TerminalBridge>();
    if (bridge) {
      return bridge;
    }
    throw new Error('Terminal bridge unavailable');
  }

  private readonly bridge: TerminalBridge;

  constructor(bridge: TerminalBridge = TerminalClient.resolveBridge()) {
    this.bridge = bridge;
  }

  create(payload: TerminalCreatePayload) {
    return this.bridge.terminalCreate(payload);
  }

  write(payload: TerminalWritePayload) {
    return this.bridge.terminalWrite(payload);
  }

  resize(payload: TerminalResizePayload) {
    return this.bridge.terminalResize(payload);
  }

  dispose(payload: TerminalDisposePayload) {
    return this.bridge.terminalDispose(payload);
  }

  onData(listener: (event: TerminalDataEvent) => void) {
    return this.bridge.onTerminalData(listener);
  }

  onExit(listener: (event: TerminalExitEvent) => void) {
    return this.bridge.onTerminalExit(listener);
  }
}
