import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StartupMetrics } from './startup-metrics';
import { createMockEnv } from '../test-utils/mock-env';

describe('StartupMetrics', () => {
  it('records checkpoints and writes report', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-startup-'));
    const env = createMockEnv({ nexusEnv: 'production', autoUpdateEnabled: true, nexusDataDir: dir });
    const metrics = new StartupMetrics(env, 1000);
    metrics.mark('app-ready');
    metrics.mark('services-ready');
    metrics.recordWindowReady('window-1');

    const reportPath = path.join(dir, 'logs', 'startup.json');
    expect(fs.existsSync(reportPath)).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    expect(report.checkpoints['app-ready']).toBeGreaterThanOrEqual(0);
    expect(report.checkpoints['window-ready']).toBeGreaterThanOrEqual(report.checkpoints['app-ready']);
  });
});
