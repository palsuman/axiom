import os from 'node:os';
import path from 'node:path';
import { createCrashReport, extractCrashReason, extractCrashStack } from './crash-report';

describe('crash-report', () => {
  it('creates sanitized crash reports from Error instances', () => {
    const home = os.homedir();
    const env = {
      nexusEnv: 'production',
      logLevel: 'info',
      defaultLocale: 'en-US',
      nexusHome: path.join(home, '.nexus'),
      nexusDataDir: path.join(home, '.nexus'),
      workspaceDataDir: path.join(home, '.nexus', 'workspaces'),
      updateChannel: 'stable',
      updateFeedUrl: undefined,
      autoUpdateEnabled: true,
      crashReportingEnabled: true,
      crashReportingUrl: 'https://ops.example.com/crash',
      crashReportingTimeoutMs: 5000,
      featureFlagsFile: path.join(home, '.nexus', 'config', 'feature-flags.json'),
      featureFlagsUrl: undefined,
      featureFlags: undefined,
      llamaCppRootDir: path.join(home, '.nexus', 'ai', 'llama.cpp'),
      llamaCppBinaryPath: undefined,
      llamaCppHost: '127.0.0.1',
      llamaCppPort: 39281,
      llamaCppHealthTimeoutMs: 3000
    } as const;
    const error = new Error(`Failed while reading ${path.join(home, 'workspace', 'app.ts')}`);
    error.stack = `Error: ${error.message}\n    at ${path.join(home, 'workspace', 'app.ts')}:10:5`;

    const report = createCrashReport({
      source: 'uncaughtException',
      error,
      env,
      cwd: path.join(home, 'workspace'),
      timestamp: '2026-03-14T12:00:00.000Z'
    });

    expect(report.timestamp).toBe('2026-03-14T12:00:00.000Z');
    expect(report.reason).toContain('<cwd>');
    expect(report.reason).not.toContain(path.join(home, 'workspace'));
    expect(report.stack).toContain('<cwd>');
    expect(report.stack).not.toContain(path.join(home, 'workspace'));
  });

  it('extracts reason and stack from unknown values', () => {
    expect(extractCrashReason({ message: 'boom' })).toBe('boom');
    expect(extractCrashReason(undefined)).toBe('Unknown error');
    expect(extractCrashStack({ stack: 'trace' })).toBe('trace');
    expect(extractCrashStack(undefined)).toBe('No stack trace available');
  });
});
