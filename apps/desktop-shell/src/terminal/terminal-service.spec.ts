import type { IPty } from 'node-pty';
import { TerminalService } from './terminal-service';

class MockPty implements IPty {
  pid = Math.floor(Math.random() * 1000);
  cols = 80;
  rows = 24;
  process = 'bash';
  handleFlowControl = false;
  private readonly dataListeners = new Set<(data: string) => void>();
  private readonly exitListeners = new Set<(event: { exitCode: number; signal?: number }) => void>();
  onData(listener: (data: string) => void) {
    this.dataListeners.add(listener);
    return { dispose: () => this.dataListeners.delete(listener) };
  }
  onExit(listener: (event: { exitCode: number; signal?: number | undefined }) => void) {
    this.exitListeners.add(listener);
    return { dispose: () => this.exitListeners.delete(listener) };
  }
  write = jest.fn((data: string) => {
    this.dataListeners.forEach(listener => listener(data));
  });
  resize = jest.fn();
  kill = jest.fn(() => {
    this.exitListeners.forEach(listener => listener({ exitCode: 0 }));
  });
  clear = jest.fn();
  pause = jest.fn();
  resume = jest.fn();
  dispose() {
    this.dataListeners.clear();
    this.exitListeners.clear();
  }
}

describe('TerminalService', () => {
  let latestPty: MockPty;
  const ptyFactory = (() => {
    return () => {
      latestPty = new MockPty();
      return latestPty;
    };
  })();

  it('creates terminals and emits data events', () => {
    const service = new TerminalService(ptyFactory);
    const dataListener = jest.fn();
    service.on('data', dataListener);
    const descriptor = service.createTerminal(1, 'session-1', { cols: 80, rows: 24 });
    expect(descriptor.terminalId).toBeDefined();
    latestPty.write('hello');
    expect(dataListener).toHaveBeenCalledWith({
      terminalId: descriptor.terminalId,
      ownerId: 1,
      data: 'hello'
    });
  });

  it('writes, resizes, and disposes terminals', () => {
    const service = new TerminalService(ptyFactory);
    const descriptor = service.createTerminal(2, 'session-1', { cols: 80, rows: 24 });
    service.write({ terminalId: descriptor.terminalId, data: 'ls' });
    expect(latestPty.write).toHaveBeenCalledWith('ls');
    service.resize({ terminalId: descriptor.terminalId, cols: 120, rows: 30 });
    expect(latestPty.resize).toHaveBeenCalledWith(120, 30);
    const disposed = service.dispose({ terminalId: descriptor.terminalId });
    expect(disposed).toBe(true);
    expect(latestPty.kill).toHaveBeenCalled();
  });

  it('disposes terminals when sessions are torn down', () => {
    const service = new TerminalService(ptyFactory);
    service.createTerminal(3, 'session-a', { cols: 80, rows: 24 });
    service.disposeBySession('session-a');
    expect(latestPty.kill).toHaveBeenCalled();
  });
});
