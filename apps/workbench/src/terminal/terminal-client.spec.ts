import type {
  TerminalCreatePayload,
  TerminalDataEvent,
  TerminalDescriptor,
  TerminalDisposePayload,
  TerminalExitEvent,
  TerminalResizePayload,
  TerminalWritePayload
} from '@nexus/contracts/ipc';
import { TerminalClient } from './terminal-client';

describe('TerminalClient', () => {
  const bridge = {
    terminalCreate: jest.fn(async (_payload: TerminalCreatePayload): Promise<TerminalDescriptor> => ({
      terminalId: 'term-1',
      pid: 123,
      shell: '/bin/bash'
    })),
    terminalWrite: jest.fn(async (_payload: TerminalWritePayload) => undefined),
    terminalResize: jest.fn(async (_payload: TerminalResizePayload) => undefined),
    terminalDispose: jest.fn(async (_payload: TerminalDisposePayload) => undefined),
    onTerminalData: jest.fn((listener: (event: TerminalDataEvent) => void) => {
      listener({ terminalId: 'term-1', data: 'hello' });
      return () => undefined;
    }),
    onTerminalExit: jest.fn((listener: (event: TerminalExitEvent) => void) => {
      listener({ terminalId: 'term-1', code: 0 });
      return () => undefined;
    })
  };

  it('delegates to bridge methods', async () => {
    const client = new TerminalClient(bridge);
    await client.create({ cols: 80, rows: 24 });
    expect(bridge.terminalCreate).toHaveBeenCalled();
    await client.write({ terminalId: 'term-1', data: 'ls' });
    expect(bridge.terminalWrite).toHaveBeenCalled();
    const disposeData = client.onData(() => undefined);
    disposeData();
    const disposeExit = client.onExit(() => undefined);
    disposeExit();
  });
});
