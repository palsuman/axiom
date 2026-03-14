import type { MonacoModel } from './monaco-types';

export type TextEncoding = 'utf8' | 'utf16le' | 'utf16be';
export type LineEnding = '\n' | '\r\n';
export type AutosaveMode = 'off' | 'afterDelay';
export type SaveReason = 'manual' | 'autosave';

export interface DocumentContent {
  value: string;
  encoding: TextEncoding;
  eol: LineEnding;
  mtime?: number;
}

export interface DocumentStorageAdapter {
  read(uri: string, options?: { encoding?: TextEncoding }): Promise<DocumentContent>;
  write(uri: string, content: DocumentContent): Promise<void>;
}

export interface DocumentOpenParams {
  uri: string;
  languageId?: string;
  encoding?: TextEncoding;
  eol?: LineEnding;
  persistent?: boolean;
  initialValue?: string;
  isReadonly?: boolean;
}

export interface TextDocumentSnapshot extends DocumentContent {
  uri: string;
  languageId?: string;
  dirty: boolean;
  lastSavedAt?: number;
  isReadonly: boolean;
  version: number;
  persistent: boolean;
}

export type DocumentEvent =
  | { type: 'dirty-change'; uri: string; dirty: boolean }
  | { type: 'saved'; uri: string; reason: SaveReason; timestamp: number }
  | { type: 'autosave-error'; uri: string; error: Error };

export interface TextModelManagerOptions {
  storage: DocumentStorageAdapter;
  autosaveMode?: AutosaveMode;
  autosaveDelayMs?: number;
}

type Timer = ReturnType<typeof setTimeout>;

type DocumentRecord = TextDocumentSnapshot & {
  lastSavedValue: string;
  autosaveTimer?: Timer;
  binding?: { dispose(): void };
};

const DEFAULT_ENCODING: TextEncoding = 'utf8';
const DEFAULT_EOL: LineEnding = '\n';
const DEFAULT_AUTOSAVE_DELAY = 1500;

export class TextModelManager {
  private readonly records = new Map<string, DocumentRecord>();
  private readonly listeners = new Set<(event: DocumentEvent) => void>();
  private autosaveMode: AutosaveMode;
  private autosaveDelay: number;

  constructor(private readonly options: TextModelManagerOptions) {
    this.autosaveMode = options.autosaveMode ?? 'afterDelay';
    this.autosaveDelay = options.autosaveDelayMs ?? DEFAULT_AUTOSAVE_DELAY;
  }

  async openDocument(params: DocumentOpenParams): Promise<TextDocumentSnapshot> {
    const uri = params.uri;
    if (!uri) {
      throw new Error('Document URI is required');
    }
    const existing = this.records.get(uri);
    if (existing) {
      if (params.languageId) {
        existing.languageId = params.languageId;
      }
      return this.snapshot(existing);
    }
    const persistent = params.persistent ?? !isVirtualUri(uri);
    const encoding = params.encoding ?? DEFAULT_ENCODING;
    const eol = params.eol ?? DEFAULT_EOL;
    const payload = await this.loadInitialContent({
      uri,
      persistent,
      encoding,
      eol,
      initialValue: params.initialValue
    });
    const record: DocumentRecord = {
      uri,
      languageId: params.languageId,
      value: payload.value,
      encoding: payload.encoding ?? encoding,
      eol: payload.eol ?? eol,
      dirty: false,
      lastSavedAt: payload.mtime,
      isReadonly: params.isReadonly ?? false,
      version: 1,
      persistent,
      lastSavedValue: payload.value
    };
    this.records.set(uri, record);
    return this.snapshot(record);
  }

  updateDocumentContent(uri: string, value: string): TextDocumentSnapshot {
    const record = this.ensureRecord(uri);
    if (value === record.value) {
      return this.snapshot(record);
    }
    record.value = value;
    record.version += 1;
    this.evaluateDirtyState(record);
    return this.snapshot(record);
  }

  bindMonacoModel(uri: string, model: MonacoModel) {
    const record = this.ensureRecord(uri);
    if (record.binding) {
      record.binding.dispose();
      record.binding = undefined;
    }
    model.setValue(record.value);
    model.updateOptions?.({ defaultEOL: record.eol === '\n' ? 0 : 1 });
    const subscription = model.onDidChangeContent(() => {
      this.updateDocumentContent(uri, model.getValue());
    });
    record.binding = { dispose: () => subscription.dispose() };
    return () => {
      if (record.binding) {
        record.binding.dispose();
        record.binding = undefined;
      }
    };
  }

  async saveDocument(uri: string, options?: { reason?: SaveReason }): Promise<TextDocumentSnapshot> {
    const record = this.ensureRecord(uri);
    if (!record.dirty) {
      return this.snapshot(record);
    }
    if (record.isReadonly) {
      throw new Error(`Document ${uri} is read-only`);
    }
    const normalizedValue = normalizeLineEndings(record.value, record.eol);
    if (record.persistent) {
      await this.options.storage.write(uri, {
        value: normalizedValue,
        encoding: record.encoding,
        eol: record.eol
      });
    }
    record.value = normalizedValue;
    record.lastSavedValue = normalizedValue;
    record.lastSavedAt = Date.now();
    record.dirty = false;
    this.clearAutosave(record);
    this.emit({
      type: 'saved',
      uri,
      reason: options?.reason ?? 'manual',
      timestamp: record.lastSavedAt
    });
    return this.snapshot(record);
  }

  setEncoding(uri: string, encoding: TextEncoding): TextDocumentSnapshot {
    const record = this.ensureRecord(uri);
    if (record.encoding === encoding) {
      return this.snapshot(record);
    }
    record.encoding = encoding;
    record.version += 1;
    record.dirty = true;
    this.emit({ type: 'dirty-change', uri, dirty: true });
    this.scheduleAutosave(record);
    return this.snapshot(record);
  }

  setLineEnding(uri: string, eol: LineEnding): TextDocumentSnapshot {
    const record = this.ensureRecord(uri);
    if (record.eol === eol) {
      return this.snapshot(record);
    }
    record.eol = eol;
    record.value = normalizeLineEndings(record.value, eol);
    record.version += 1;
    this.evaluateDirtyState(record);
    return this.snapshot(record);
  }

  closeDocument(uri: string): boolean {
    const record = this.records.get(uri);
    if (!record) return false;
    this.clearAutosave(record);
    if (record.binding) {
      record.binding.dispose();
    }
    return this.records.delete(uri);
  }

  getSnapshot(uri: string): TextDocumentSnapshot {
    return this.snapshot(this.ensureRecord(uri));
  }

  listOpenDocuments(): TextDocumentSnapshot[] {
    return Array.from(this.records.values()).map(record => this.snapshot(record));
  }

  applyContentSnapshot(uri: string, value: string, options?: { markDirty?: boolean }) {
    const record = this.ensureRecord(uri);
    record.value = value;
    record.version += 1;
    if (options?.markDirty) {
      record.lastSavedValue = `${value}__backup__${Date.now()}`;
      if (!record.dirty) {
        record.dirty = true;
        this.emit({ type: 'dirty-change', uri, dirty: true });
      }
      this.scheduleAutosave(record);
    } else {
      record.lastSavedValue = value;
      if (record.dirty) {
        record.dirty = false;
        this.emit({ type: 'dirty-change', uri, dirty: false });
      }
      this.clearAutosave(record);
    }
  }

  configureAutosave(options: { mode?: AutosaveMode; delayMs?: number }) {
    if (options.mode) {
      this.autosaveMode = options.mode;
    }
    if (typeof options.delayMs === 'number' && options.delayMs >= 0) {
      this.autosaveDelay = options.delayMs;
    }
    this.records.forEach(record => {
      this.clearAutosave(record);
      if (record.dirty) {
        this.scheduleAutosave(record);
      }
    });
  }

  onDidChange(listener: (event: DocumentEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async loadInitialContent(params: {
    uri: string;
    persistent: boolean;
    encoding: TextEncoding;
    eol: LineEnding;
    initialValue?: string;
  }) {
    if (!params.persistent) {
      return {
        value: params.initialValue ?? '',
        encoding: params.encoding,
        eol: params.eol
      };
    }
    try {
      return await this.options.storage.read(params.uri, { encoding: params.encoding });
    } catch (error) {
      if (params.initialValue !== undefined) {
        return {
          value: params.initialValue,
          encoding: params.encoding,
          eol: params.eol
        };
      }
      throw error;
    }
  }

  private evaluateDirtyState(record: DocumentRecord) {
    const dirtyBefore = record.dirty;
    record.dirty = record.value !== record.lastSavedValue;
    if (dirtyBefore !== record.dirty) {
      this.emit({ type: 'dirty-change', uri: record.uri, dirty: record.dirty });
    }
    if (record.dirty) {
      this.scheduleAutosave(record);
    } else {
      this.clearAutosave(record);
    }
  }

  private scheduleAutosave(record: DocumentRecord) {
    if (this.autosaveMode !== 'afterDelay' || record.isReadonly || !record.persistent) {
      return;
    }
    this.clearAutosave(record);
    record.autosaveTimer = setTimeout(() => {
      record.autosaveTimer = undefined;
      this.saveDocument(record.uri, { reason: 'autosave' }).catch(error => {
        this.emit({ type: 'autosave-error', uri: record.uri, error });
      });
    }, this.autosaveDelay);
  }

  private clearAutosave(record: DocumentRecord) {
    if (record.autosaveTimer) {
      clearTimeout(record.autosaveTimer);
      record.autosaveTimer = undefined;
    }
  }

  private ensureRecord(uri: string) {
    const record = this.records.get(uri);
    if (!record) {
      throw new Error(`Document ${uri} is not open`);
    }
    return record;
  }

  private snapshot(record: DocumentRecord): TextDocumentSnapshot {
    return {
      uri: record.uri,
      languageId: record.languageId,
      value: record.value,
      encoding: record.encoding,
      eol: record.eol,
      dirty: record.dirty,
      lastSavedAt: record.lastSavedAt,
      isReadonly: record.isReadonly,
      version: record.version,
      persistent: record.persistent
    };
  }

  private emit(event: DocumentEvent) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.warn('[text-model-manager] listener error', error);
      }
    });
  }
}

function normalizeLineEndings(value: string, eol: LineEnding) {
  const normalized = value.replace(/\r\n|\r/g, '\n');
  return eol === '\n' ? normalized : normalized.replace(/\n/g, '\r\n');
}

function isVirtualUri(uri: string) {
  return uri.startsWith('virtual://');
}
