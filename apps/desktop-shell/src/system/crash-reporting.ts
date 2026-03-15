import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { TelemetryTrackPayload } from '@nexus/contracts/ipc';
import type { NexusEnv } from '@nexus/platform/config/env';
import { createCrashReport, type CrashReport } from '@nexus/platform/observability/crash-report';
import { log, logError } from './logger';

type CrashTelemetrySink = {
  track: (payload: TelemetryTrackPayload) => unknown;
};

type FetchResponseLike = {
  ok: boolean;
  status: number;
  headers?: {
    get(name: string): string | null | undefined;
  };
  text?: () => Promise<string>;
};

type FetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  }
) => Promise<FetchResponseLike>;

type CrashReporterDependencies = {
  fs?: typeof fs;
  fetch?: FetchLike;
  now?: () => Date;
  cwd?: string;
  platform?: string;
  release?: string;
  arch?: string;
  nodeVersion?: string;
  telemetry?: CrashTelemetrySink;
  featureFlags?: {
    isEnabled: (key: string) => boolean;
  };
  privacy?: {
    canShareCrashReports: (workspaceId?: string) => boolean;
  };
  localSink?: LocalCrashFileSink;
  remoteSink?: EnterpriseCrashEndpointSink;
};

export type CrashCaptureResult = {
  report: CrashReport;
  localPath: string;
  submitAvailable: boolean;
};

export type CrashSubmitResult = {
  ok: boolean;
  status?: number;
  requestId?: string;
  error?: string;
};

export class LocalCrashFileSink {
  constructor(
    public readonly logPath: string,
    private readonly fsApi: typeof fs = fs
  ) {}

  persist(report: CrashReport) {
    this.fsApi.mkdirSync(path.dirname(this.logPath), { recursive: true });
    const entry = [
      '',
      `[${report.timestamp}] id=${report.id} source=${report.source}`,
      `reason=${report.reason}`,
      `runtime=${report.runtime.platform}/${report.runtime.release} arch=${report.runtime.arch} node=${report.runtime.nodeVersion} env=${report.runtime.nexusEnv}`,
      report.stack
    ].join('\n');
    this.fsApi.appendFileSync(this.logPath, `${entry}\n`, 'utf8');
    return this.logPath;
  }
}

export class EnterpriseCrashEndpointSink {
  private readonly fetchImpl?: FetchLike;

  constructor(
    private readonly endpointUrl: string,
    private readonly timeoutMs: number,
    fetchImpl?: FetchLike
  ) {
    this.fetchImpl = fetchImpl;
  }

  async submit(report: CrashReport): Promise<CrashSubmitResult> {
    const fetchApi =
      this.fetchImpl ??
      (typeof globalThis.fetch === 'function' ? ((globalThis.fetch as unknown) as FetchLike) : undefined);
    if (!fetchApi) {
      return {
        ok: false,
        error: 'Crash reporting fetch implementation is unavailable'
      };
    }

    let response: FetchResponseLike;
    try {
      response = await withTimeout(
        fetchApi(this.endpointUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-nexus-crash-report-id': report.id
          },
          body: JSON.stringify(report)
        }),
        this.timeoutMs,
        `Crash reporting request timed out after ${this.timeoutMs}ms`
      );
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        requestId: response.headers?.get('x-request-id') ?? undefined
      };
    }

    const body = response.text ? await response.text().catch(() => '') : '';
    return {
      ok: false,
      status: response.status,
      error: body.trim() || `Crash reporting endpoint returned HTTP ${response.status}`
    };
  }
}

export class CrashReporter {
  private readonly telemetry?: CrashTelemetrySink;
  private readonly now: () => Date;
  private readonly cwd: string;
  private readonly platform: string;
  private readonly release: string;
  private readonly arch: string;
  private readonly nodeVersion: string;
  private readonly localSink: LocalCrashFileSink;
  private readonly remoteSink?: EnterpriseCrashEndpointSink;
  private readonly featureFlags?: NonNullable<CrashReporterDependencies['featureFlags']>;
  private readonly privacy?: NonNullable<CrashReporterDependencies['privacy']>;

  constructor(
    private readonly env: NexusEnv,
    deps: CrashReporterDependencies = {}
  ) {
    this.telemetry = deps.telemetry;
    this.now = deps.now ?? (() => new Date());
    this.cwd = deps.cwd ?? process.cwd();
    this.platform = deps.platform ?? process.platform;
    this.release = deps.release ?? os.release();
    this.arch = deps.arch ?? process.arch;
    this.nodeVersion = deps.nodeVersion ?? process.version;
    this.featureFlags = deps.featureFlags;
    this.privacy = deps.privacy;
    this.localSink =
      deps.localSink ??
      new LocalCrashFileSink(path.join(this.env.nexusDataDir ?? this.env.nexusHome, 'logs', 'crash.log'), deps.fs ?? fs);
    this.remoteSink =
      deps.remoteSink ??
      (this.env.crashReportingEnabled && this.env.crashReportingUrl
        ? new EnterpriseCrashEndpointSink(
            this.env.crashReportingUrl,
            this.env.crashReportingTimeoutMs,
            deps.fetch
          )
        : undefined);
  }

  capture(source: string, error: unknown): CrashCaptureResult {
    const report = createCrashReport({
      source,
      error,
      env: this.env,
      timestamp: this.now().toISOString(),
      cwd: this.cwd,
      platform: this.platform,
      release: this.release,
      arch: this.arch,
      nodeVersion: this.nodeVersion,
      processType: 'main'
    });
    let localPath = this.localSink.logPath;
    try {
      localPath = this.localSink.persist(report);
    } catch (error) {
      logError('Failed to persist crash report locally', error);
    }
    this.telemetry?.track({
      name: 'desktop.crash.captured',
      scope: 'main',
      level: 'error',
      message: report.reason,
      attributes: {
        reportId: report.id,
        source,
        localPath
      }
    });
    log(`Crash info written to ${localPath}`);
    return {
      report,
      localPath,
      submitAvailable: this.canSubmit()
    };
  }

  canSubmit() {
    return (
      Boolean(this.remoteSink) &&
      this.featureFlags?.isEnabled('observability.remoteCrashReporting') !== false &&
      this.privacy?.canShareCrashReports() !== false
    );
  }

  async submit(report: CrashReport): Promise<CrashSubmitResult> {
    if (!this.remoteSink || !this.canSubmit()) {
      return {
        ok: false,
        error: 'Crash reporting endpoint is not available'
      };
    }

    const result = await this.remoteSink.submit(report);
    if (result.ok) {
      this.telemetry?.track({
        name: 'desktop.crash.report.sent',
        scope: 'main',
        level: 'info',
        message: 'Crash report uploaded',
        attributes: result.requestId
          ? {
              reportId: report.id,
              requestId: result.requestId
            }
          : {
              reportId: report.id
            },
        measurements: result.status ? { status: result.status } : undefined
      });
    } else {
      this.telemetry?.track({
        name: 'desktop.crash.report.failed',
        scope: 'main',
        level: 'warn',
        message: result.error ?? 'Crash report upload failed',
        attributes: {
          reportId: report.id
        },
        measurements: result.status ? { status: result.status } : undefined
      });
      logError('Failed to upload crash report', result.error);
    }
    return result;
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
