import fs from 'node:fs';
import path from 'node:path';
import type {
  TelemetryHealthResponse,
  TelemetryLevel,
  TelemetryRecord,
  TelemetryReplayRequest,
  TelemetryReplayResponse,
  TelemetryTrackPayload
} from '@nexus/contracts/ipc';

const REDACTED_VALUE = '[REDACTED]';
const DEFAULT_MAX_EVENTS = 1000;
const DEFAULT_MAX_FILE_BYTES = 2_000_000;
const SENSITIVE_KEY_PATTERN = /(token|secret|password|authorization|cookie|key)/i;

type TelemetryStoreOptions = {
  bufferPath: string;
  maxEvents?: number;
  maxFileBytes?: number;
  now?: () => number;
};

type PersistedState = {
  records: TelemetryRecord[];
  dropped: number;
  lastSequence: number;
};

export class TelemetryStore {
  private readonly bufferPath: string;
  private readonly maxEvents: number;
  private readonly maxFileBytes: number;
  private readonly now: () => number;
  private readonly state: PersistedState;

  constructor(options: TelemetryStoreOptions) {
    this.bufferPath = options.bufferPath;
    this.maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;
    this.maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
    this.now = options.now ?? (() => Date.now());
    this.state = this.loadState();
  }

  track(payload: TelemetryTrackPayload): TelemetryRecord {
    const record = this.normalizePayload(payload);
    this.state.records.push(record);
    this.state.lastSequence = record.sequence;
    this.pruneIfNeeded();
    this.persist();
    return cloneRecord(record);
  }

  replay(request: TelemetryReplayRequest = {}): TelemetryReplayResponse {
    const records = this.filterRecords(request);
    const limit = request.limit ?? 100;
    return {
      records: records.slice(-limit).reverse().map(cloneRecord),
      totalBuffered: this.state.records.length,
      dropped: this.state.dropped,
      bufferPath: this.bufferPath
    };
  }

  getHealth(): TelemetryHealthResponse {
    const levels: Record<TelemetryLevel, number> = {
      error: 0,
      warn: 0,
      info: 0,
      debug: 0
    };
    const scopes: TelemetryHealthResponse['scopes'] = {
      main: 0,
      renderer: 0,
      preload: 0,
      shared: 0
    };

    this.state.records.forEach(record => {
      levels[record.level] += 1;
      scopes[record.scope] += 1;
    });

    return {
      bufferPath: this.bufferPath,
      eventCount: this.state.records.length,
      fileBytes: this.getFileBytes(),
      dropped: this.state.dropped,
      lastSequence: this.state.lastSequence,
      oldestRecordedAt: this.state.records[0]?.recordedAt,
      newestRecordedAt: this.state.records[this.state.records.length - 1]?.recordedAt,
      levels,
      scopes
    };
  }

  private normalizePayload(payload: TelemetryTrackPayload): TelemetryRecord {
    const recordedAt = payload.timestamp ?? this.now();
    return {
      sequence: this.state.lastSequence + 1,
      recordedAt,
      name: payload.name.trim(),
      scope: payload.scope,
      level: payload.level ?? 'info',
      message: payload.message?.trim() || undefined,
      attributes: sanitizeAttributes(payload.attributes),
      measurements: sanitizeMeasurements(payload.measurements),
      tags: sanitizeTags(payload.tags),
      sessionId: payload.sessionId?.trim() || undefined,
      workspaceId: payload.workspaceId?.trim() || undefined
    };
  }

  private filterRecords(request: TelemetryReplayRequest) {
    return this.state.records.filter(record => {
      if (request.scope && record.scope !== request.scope) {
        return false;
      }
      if (request.level && record.level !== request.level) {
        return false;
      }
      if (request.name && record.name !== request.name) {
        return false;
      }
      return true;
    });
  }

  private pruneIfNeeded() {
    while (this.state.records.length > this.maxEvents) {
      this.state.records.shift();
      this.state.dropped += 1;
    }

    while (estimateFileBytes(this.state.records) > this.maxFileBytes && this.state.records.length > 1) {
      this.state.records.shift();
      this.state.dropped += 1;
    }
  }

  private loadState(): PersistedState {
    if (!fs.existsSync(this.bufferPath)) {
      return {
        records: [],
        dropped: 0,
        lastSequence: 0
      };
    }

    const raw = fs.readFileSync(this.bufferPath, 'utf8').trim();
    if (!raw) {
      return {
        records: [],
        dropped: 0,
        lastSequence: 0
      };
    }

    const lines = raw.split('\n').filter(Boolean);
    const records: TelemetryRecord[] = [];
    let dropped = 0;
    let lastSequence = 0;

    lines.forEach(line => {
      const parsed = JSON.parse(line) as PersistedTelemetryLine;
      if (parsed.kind === 'meta') {
        dropped = parsed.dropped;
        lastSequence = parsed.lastSequence;
        return;
      }
      records.push(parsed.record);
      lastSequence = Math.max(lastSequence, parsed.record.sequence);
    });

    return {
      records,
      dropped,
      lastSequence
    };
  }

  private persist() {
    const directory = path.dirname(this.bufferPath);
    fs.mkdirSync(directory, { recursive: true });
    const lines = this.state.records.map(record =>
      JSON.stringify({
        kind: 'record',
        record
      } satisfies PersistedTelemetryLine)
    );
    lines.push(
      JSON.stringify({
        kind: 'meta',
        dropped: this.state.dropped,
        lastSequence: this.state.lastSequence
      } satisfies PersistedTelemetryLine)
    );
    fs.writeFileSync(this.bufferPath, `${lines.join('\n')}\n`, 'utf8');
  }

  private getFileBytes() {
    try {
      return fs.statSync(this.bufferPath).size;
    } catch {
      return 0;
    }
  }
}

type PersistedTelemetryLine =
  | {
      kind: 'record';
      record: TelemetryRecord;
    }
  | {
      kind: 'meta';
      dropped: number;
      lastSequence: number;
    };

function sanitizeAttributes(attributes?: TelemetryTrackPayload['attributes']) {
  const normalized: TelemetryRecord['attributes'] = {};
  Object.entries(attributes ?? {}).forEach(([key, value]) => {
    normalized[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED_VALUE : value;
  });
  return normalized;
}

function sanitizeMeasurements(measurements?: TelemetryTrackPayload['measurements']) {
  const normalized: TelemetryRecord['measurements'] = {};
  Object.entries(measurements ?? {}).forEach(([key, value]) => {
    if (!Number.isFinite(value)) {
      return;
    }
    normalized[key] = value;
  });
  return normalized;
}

function sanitizeTags(tags?: string[]) {
  return Array.from(
    new Set((tags ?? []).map(tag => tag.trim()).filter(tag => tag.length > 0))
  ).sort((left, right) => left.localeCompare(right));
}

function estimateFileBytes(records: readonly TelemetryRecord[]) {
  const metaEstimate = 128;
  return (
    records.reduce((total, record) => total + Buffer.byteLength(JSON.stringify(record), 'utf8') + 20, 0) + metaEstimate
  );
}

function cloneRecord(record: TelemetryRecord): TelemetryRecord {
  return {
    ...record,
    attributes: { ...record.attributes },
    measurements: { ...record.measurements },
    tags: [...record.tags]
  };
}
