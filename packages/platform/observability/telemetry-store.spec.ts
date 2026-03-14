import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TelemetryStore } from './telemetry-store';

describe('TelemetryStore', () => {
  it('tracks, replays, and redacts sensitive attributes', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-telemetry-store-'));
    const store = new TelemetryStore({
      bufferPath: path.join(tempDir, 'telemetry', 'events.jsonl'),
      now: () => 1000
    });

    const record = store.track({
      name: 'renderer.log',
      scope: 'renderer',
      attributes: {
        password: 'secret',
        locale: 'en-US'
      },
      measurements: {
        durationMs: 42
      },
      tags: ['renderer', 'log']
    });

    expect(record.sequence).toBe(1);
    expect(record.attributes.password).toBe('[REDACTED]');
    expect(record.attributes.locale).toBe('en-US');

    const replay = store.replay({ limit: 10 });
    expect(replay.records).toHaveLength(1);
    expect(replay.records[0].name).toBe('renderer.log');
    expect(store.getHealth().eventCount).toBe(1);
  });

  it('prunes old events when max buffer size is exceeded', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-telemetry-prune-'));
    const store = new TelemetryStore({
      bufferPath: path.join(tempDir, 'telemetry', 'events.jsonl'),
      maxEvents: 2,
      now: (() => {
        let tick = 0;
        return () => {
          tick += 1;
          return tick;
        };
      })()
    });

    store.track({ name: 'one', scope: 'main' });
    store.track({ name: 'two', scope: 'main' });
    store.track({ name: 'three', scope: 'main' });

    const replay = store.replay({ limit: 10 });
    expect(replay.records.map(record => record.name)).toEqual(['three', 'two']);
    expect(replay.dropped).toBe(1);
    expect(store.getHealth().lastSequence).toBe(3);
  });
});
