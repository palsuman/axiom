import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildIgnoreMatcher, WorkspaceWatcher, WorkspaceWatchEvent, WatcherAdapter, WatcherFactory, WorkspaceWatchEventType } from './workspace-watcher';

describe('WorkspaceWatcher ignore matcher', () => {
  it('merges default, gitignore, and additional patterns', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-ignore-'));
    fs.writeFileSync(
      path.join(tempDir, '.gitignore'),
      ['dist', '*.log'].join('\n'),
      'utf8'
    );

    const matcher = buildIgnoreMatcher(tempDir, {
      additionalPatterns: ['coverage', 'custom/*.tmp']
    });

    expect(matcher(path.join(tempDir, 'dist/app.js'))).toBe(true);
    expect(matcher(path.join(tempDir, 'notes/info.log'))).toBe(true);
    expect(matcher(path.join(tempDir, 'coverage/index.html'))).toBe(true);
    expect(matcher(path.join(tempDir, 'custom/file.tmp'))).toBe(true);
    expect(matcher(path.join(tempDir, 'src/index.ts'))).toBe(false);
  });
});

describe('WorkspaceWatcher event flow', () => {
  it('emits events from multiple roots and supports ready/error hooks', async () => {
    const stubs: StubWatcher[] = [];
    const factory: WatcherFactory = ({ root }) => {
      const stub = new StubWatcher(root);
      stubs.push(stub);
      return stub;
    };

    const events: WorkspaceWatchEvent[] = [];
    const readyCalls: number[] = [];
    const errors: Error[] = [];
    const watcher = new WorkspaceWatcher({ roots: ['/repo/a', '/repo/b'] }, factory);

    watcher.onEvent(evt => events.push(evt));
    watcher.onReady(() => readyCalls.push(readyCalls.length + 1));
    watcher.onError(err => errors.push(err));

    stubs.forEach(stub => stub.emit('ready'));
    expect(readyCalls).toHaveLength(1);

    stubs[0].emit('all', 'add', '/repo/a/src/index.ts');
    stubs[1].emit('all', 'change', '/repo/b/README.md');
    stubs[0].emit('error', new Error('disk full'));

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: 'add', root: '/repo/a', relativePath: path.normalize('src/index.ts') });
    expect(events[1]).toMatchObject({ type: 'change', root: '/repo/b', relativePath: 'README.md' });
    expect(errors).toHaveLength(1);

    await watcher.dispose();
    expect(stubs.every(stub => stub.closed)).toBe(true);
  });
});

class StubWatcher implements WatcherAdapter {
  private readonly listeners = new Map<string, Array<(...args: any[]) => void>>();
  public closed = false;

  constructor(public readonly root: string) {}

  on(event: 'all', handler: (event: WorkspaceWatchEventType, filePath: string) => void): WatcherAdapter;
  on(event: 'ready', handler: () => void): WatcherAdapter;
  on(event: 'error', handler: (error: Error) => void): WatcherAdapter;
  on(event: string, handler: (...args: any[]) => void): WatcherAdapter {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
    return this;
  }

  emit(event: 'all', type: WorkspaceWatchEventType, filePath: string): void;
  emit(event: 'ready'): void;
  emit(event: 'error', error: Error): void;
  emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach(handler => handler(...args));
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}
