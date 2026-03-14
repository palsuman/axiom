import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import path from 'node:path';
import type { NexusEnv } from '@nexus/platform/config/env';
import type { TelemetryTrackPayload } from '@nexus/contracts/ipc';
import { log, logError } from './logger';

type StartupReport = {
  startedAt: string;
  totalMs: number;
  checkpoints: Record<string, number>;
};

const DEFAULT_BUDGET_MS = 3000;

type TelemetrySink = {
  track: (payload: TelemetryTrackPayload) => unknown;
};

export class StartupMetrics {
  private readonly startTime = performance.now();
  private readonly startedAt = new Date();
  private readonly marks = new Map<string, number>();
  private completed = false;
  private firstWindowId: string | null = null;

  constructor(
    private readonly env: NexusEnv,
    private readonly budgetMs = DEFAULT_BUDGET_MS,
    private readonly telemetry?: TelemetrySink
  ) {
    this.mark('bootstrap:start');
  }

  mark(label: string) {
    this.marks.set(label, performance.now());
  }

  recordWindowReady(windowId: string) {
    if (this.firstWindowId) return;
    this.firstWindowId = windowId;
    this.mark('window-ready');
    this.complete();
  }

  complete() {
    if (this.completed) return;
    this.completed = true;
    const report = this.buildReport();
    const status = report.totalMs <= this.budgetMs ? 'within budget' : `over budget (+${Math.round(report.totalMs - this.budgetMs)}ms)`;
    log(`[startup] total=${Math.round(report.totalMs)}ms status=${status}`);
    this.writeReport(report);
    this.telemetry?.track({
      name: 'desktop.startup.completed',
      scope: 'main',
      level: report.totalMs <= this.budgetMs ? 'info' : 'warn',
      attributes: {
        status: report.totalMs <= this.budgetMs ? 'within-budget' : 'over-budget',
        firstWindowId: this.firstWindowId ?? null
      },
      measurements: {
        totalMs: report.totalMs,
        checkpointCount: Object.keys(report.checkpoints).length
      }
    });
  }

  private buildReport(): StartupReport {
    const entries: Record<string, number> = {};
    Array.from(this.marks.entries()).forEach(([label, timestamp]) => {
      entries[label] = timestamp - this.startTime;
    });
    const totalMs = this.marks.has('window-ready')
      ? (this.marks.get('window-ready') as number) - this.startTime
      : performance.now() - this.startTime;
    return {
      startedAt: this.startedAt.toISOString(),
      totalMs,
      checkpoints: entries
    };
  }

  private writeReport(report: StartupReport) {
    try {
      const dir = path.join(this.env.nexusDataDir ?? this.env.nexusHome, 'logs');
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, 'startup.json');
      fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
      log(`[startup] metrics written to ${filePath}`);
    } catch (error) {
      logError('Failed to write startup report', error);
    }
  }
}
