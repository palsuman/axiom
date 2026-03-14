import { TextModelManager, type DocumentStorageAdapter, type DocumentContent } from './text-model-manager';
import type { MonacoModel } from './monaco-types';

class MemoryStorage implements DocumentStorageAdapter {
  public reads = 0;
  public writes: Array<{ uri: string; content: DocumentContent }> = [];
  private readonly store = new Map<string, DocumentContent>();

  constructor(seed?: Record<string, DocumentContent>) {
    Object.entries(seed ?? {}).forEach(([uri, content]) => this.store.set(uri, { ...content }));
  }

  async read(uri: string): Promise<DocumentContent> {
    this.reads += 1;
    const entry = this.store.get(uri);
    if (!entry) {
      throw new Error(`Missing ${uri}`);
    }
    return { ...entry };
  }

  async write(uri: string, content: DocumentContent): Promise<void> {
    this.store.set(uri, { ...content });
    this.writes.push({ uri, content: { ...content } });
  }
}

function createModel(initialValue = '') {
  let value = initialValue;
  const listeners = new Set<() => void>();
  const model: MonacoModel & { $emit(): void } = {
    uri: { toString: () => 'file:///doc.ts' },
    getValue: () => value,
    setValue: newValue => {
      value = newValue;
    },
    updateOptions: jest.fn(),
    dispose: jest.fn(),
    onDidChangeContent: listener => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    $emit: () => {
      listeners.forEach(listener => listener());
    }
  };
  return model;
}

describe('TextModelManager', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens persistent documents once and caches snapshots', async () => {
    const adapter = new MemoryStorage({
      'file:///repo/app.ts': { value: 'console.log("hi")', encoding: 'utf8', eol: '\n' }
    });
    const manager = new TextModelManager({ storage: adapter, autosaveMode: 'off' });
    const first = await manager.openDocument({ uri: 'file:///repo/app.ts', languageId: 'typescript' });
    expect(first.value).toBe('console.log("hi")');
    const second = await manager.openDocument({ uri: 'file:///repo/app.ts' });
    expect(second).toEqual(first);
    expect(adapter.reads).toBe(1);
  });

  it('marks dirty and auto-saves after delay', async () => {
    jest.useFakeTimers();
    const adapter = new MemoryStorage({
      'file:///repo/index.ts': { value: 'export const a = 1;', encoding: 'utf8', eol: '\n' }
    });
    const manager = new TextModelManager({ storage: adapter, autosaveDelayMs: 200 });
    await manager.openDocument({ uri: 'file:///repo/index.ts' });
    const events: string[] = [];
    manager.onDidChange(event => {
      if (event.type === 'dirty-change') {
        events.push(`${event.type}:${event.dirty}`);
      }
    });
    manager.updateDocumentContent('file:///repo/index.ts', 'export const a = 2;');
    expect(events).toContain('dirty-change:true');
    expect(adapter.writes).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(250);
    expect(adapter.writes).toHaveLength(1);
    const storageWrite = adapter.writes[0]?.content.value;
    expect(storageWrite).toBe('export const a = 2;');
    const snapshot = manager.getSnapshot('file:///repo/index.ts');
    expect(snapshot.dirty).toBe(false);
  });

  it('updates encoding and line endings before save', async () => {
    const adapter = new MemoryStorage({
      'file:///repo/readme.md': { value: 'Line1\nLine2', encoding: 'utf8', eol: '\n' }
    });
    const manager = new TextModelManager({ storage: adapter, autosaveMode: 'off' });
    await manager.openDocument({ uri: 'file:///repo/readme.md' });
    manager.setLineEnding('file:///repo/readme.md', '\r\n');
    manager.setEncoding('file:///repo/readme.md', 'utf16le');
    await manager.saveDocument('file:///repo/readme.md');
    expect(adapter.writes).toHaveLength(1);
    expect(adapter.writes[0]?.content.eol).toBe('\r\n');
    expect(adapter.writes[0]?.content.encoding).toBe('utf16le');
  });

  it('binds to Monaco models and tracks updates', async () => {
    const adapter = new MemoryStorage({
      'file:///repo/model.ts': { value: 'const x = 1;', encoding: 'utf8', eol: '\n' }
    });
    const manager = new TextModelManager({ storage: adapter, autosaveMode: 'off' });
    await manager.openDocument({ uri: 'file:///repo/model.ts' });
    const model = createModel('');
    const dispose = manager.bindMonacoModel('file:///repo/model.ts', model);
    model.setValue('const y = 2;');
    model.$emit();
    expect(manager.getSnapshot('file:///repo/model.ts').dirty).toBe(true);
    dispose();
  });

  it('supports virtual documents without touching storage', async () => {
    const adapter = new MemoryStorage();
    const manager = new TextModelManager({ storage: adapter, autosaveMode: 'off' });
    await manager.openDocument({ uri: 'virtual://welcome', persistent: false, initialValue: '# Welcome' });
    manager.updateDocumentContent('virtual://welcome', '# Updated');
    await manager.saveDocument('virtual://welcome');
    expect(adapter.writes).toHaveLength(0);
    expect(manager.closeDocument('virtual://welcome')).toBe(true);
  });
});
