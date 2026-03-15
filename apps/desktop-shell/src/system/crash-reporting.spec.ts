import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CrashReporter } from './crash-reporting';
import { createMockEnv } from '../test-utils/mock-env';

describe('CrashReporter', () => {
  it('persists sanitized crash details locally', () => {
    const home = os.homedir();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-crash-reporter-'));
    const env = createMockEnv({
      nexusEnv: 'production',
      nexusDataDir: tempDir,
      crashReportingEnabled: false
    });
    const telemetry = { track: jest.fn() };
    const reporter = new CrashReporter(env, {
      telemetry,
      cwd: path.join(home, 'workspace'),
      now: () => new Date('2026-03-14T12:00:00.000Z')
    });
    const error = new Error(`Boom in ${path.join(home, 'workspace', 'src', 'app.ts')}`);
    error.stack = `Error: ${error.message}\n    at ${path.join(home, 'workspace', 'src', 'app.ts')}:10:5`;

    const result = reporter.capture('uncaughtException', error);

    expect(result.submitAvailable).toBe(false);
    const logContents = fs.readFileSync(result.localPath, 'utf8');
    expect(logContents).toContain('<cwd>');
    expect(logContents).not.toContain(path.join(home, 'workspace'));
    expect(telemetry.track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'desktop.crash.captured',
        scope: 'main',
        level: 'error'
      })
    );
  });

  it('submits crash reports to the configured enterprise endpoint', async () => {
    const env = createMockEnv({
      crashReportingEnabled: true,
      crashReportingUrl: 'https://ops.example.com/crash',
      crashReportingTimeoutMs: 2500
    });
    const telemetry = { track: jest.fn() };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 202,
      headers: {
        get: (name: string) => (name === 'x-request-id' ? 'req-123' : null)
      }
    });
    const reporter = new CrashReporter(env, {
      telemetry,
      fetch: fetchMock,
      featureFlags: {
        isEnabled: () => true
      }
    });
    const { report } = reporter.capture('render-process-gone', new Error('Renderer died'));

    const result = await reporter.submit(report);

    expect(result).toEqual({
      ok: true,
      status: 202,
      requestId: 'req-123'
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ops.example.com/crash',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-nexus-crash-report-id': report.id
        })
      })
    );
    expect(telemetry.track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'desktop.crash.report.sent',
        scope: 'main',
        level: 'info'
      })
    );
  });

  it('records submission failures without throwing', async () => {
    const env = createMockEnv({
      crashReportingEnabled: true,
      crashReportingUrl: 'https://ops.example.com/crash'
    });
    const telemetry = { track: jest.fn() };
    const reporter = new CrashReporter(env, {
      telemetry,
      fetch: jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'upstream failed'
      }),
      featureFlags: {
        isEnabled: () => true
      }
    });
    const { report } = reporter.capture('uncaughtException', new Error('Boom'));

    const result = await reporter.submit(report);

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: 'upstream failed'
    });
    expect(telemetry.track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'desktop.crash.report.failed',
        scope: 'main',
        level: 'warn'
      })
    );
  });

  it('honors the remote crash-reporting kill switch', async () => {
    const env = createMockEnv({
      crashReportingEnabled: true,
      crashReportingUrl: 'https://ops.example.com/crash'
    });
    const reporter = new CrashReporter(env, {
      fetch: jest.fn(),
      featureFlags: {
        isEnabled: key => key !== 'observability.remoteCrashReporting'
      }
    });
    const { report, submitAvailable } = reporter.capture('uncaughtException', new Error('Boom'));

    const result = await reporter.submit(report);

    expect(submitAvailable).toBe(false);
    expect(result).toEqual({
      ok: false,
      error: 'Crash reporting endpoint is not available'
    });
  });

  it('respects privacy consent for remote crash sharing', async () => {
    const env = createMockEnv({
      crashReportingEnabled: true,
      crashReportingUrl: 'https://ops.example.com/crash'
    });
    const reporter = new CrashReporter(env, {
      fetch: jest.fn(),
      featureFlags: {
        isEnabled: () => true
      },
      privacy: {
        canShareCrashReports: () => false
      }
    });
    const { report, submitAvailable } = reporter.capture('uncaughtException', new Error('Boom'));

    const result = await reporter.submit(report);

    expect(submitAvailable).toBe(false);
    expect(result).toEqual({
      ok: false,
      error: 'Crash reporting endpoint is not available'
    });
  });
});
