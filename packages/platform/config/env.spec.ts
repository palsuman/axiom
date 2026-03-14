import os from 'node:os';
import path from 'node:path';
import { readEnv } from './env';

describe('readEnv', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('uses defaults when unset', () => {
    delete process.env.NEXUS_ENV;
    delete process.env.LOG_LEVEL;
    delete process.env.NEXUS_HOME;
    delete process.env.NEXUS_DATA_DIR;
    delete process.env.NEXUS_WORKSPACE_DATA;
    delete process.env.NEXUS_LOCALE;
    const env = readEnv();
    expect(env.nexusEnv).toBe('development');
    expect(env.logLevel).toBe('info');
    expect(env.nexusHome).toBe(path.join(os.homedir(), '.nexus'));
    expect(env.nexusDataDir).toBe(env.nexusHome);
    expect(env.workspaceDataDir).toBe(path.join(env.nexusDataDir, 'workspaces'));
    expect(env.updateChannel).toBe('stable');
    expect(env.autoUpdateEnabled).toBe(false);
    expect(env.defaultLocale).toBe('en-US');
    expect(env.crashReportingEnabled).toBe(false);
    expect(env.crashReportingUrl).toBeUndefined();
    expect(env.crashReportingTimeoutMs).toBe(5000);
    expect(env.featureFlagsFile).toBe(path.join(env.nexusDataDir, 'config', 'feature-flags.json'));
    expect(env.featureFlagsUrl).toBeUndefined();
    expect(env.featureFlags).toBeUndefined();
  });

  it('throws on invalid NEXUS_ENV', () => {
    process.env.NEXUS_ENV = 'invalid';
    expect(() => readEnv()).toThrow(/Invalid NEXUS_ENV/);
  });

  it('throws on invalid update channel', () => {
    process.env.NEXUS_UPDATE_CHANNEL = 'nightly';
    expect(() => readEnv()).toThrow(/Invalid NEXUS_UPDATE_CHANNEL/);
  });

  it('resolves custom directories and locale', () => {
    process.env.NEXUS_HOME = '/tmp/nexus-home';
    process.env.NEXUS_DATA_DIR = '~/nexus-data';
    process.env.NEXUS_WORKSPACE_DATA = 'custom/workspaces';
    process.env.NEXUS_LOCALE = 'fr-FR';
    process.env.NEXUS_CRASH_REPORTING_URL = 'https://ops.example.com/crash';
    process.env.NEXUS_FEATURE_FLAGS_FILE = './flags.json';
    process.env.NEXUS_FEATURE_FLAGS_URL = 'https://ops.example.com/flags.json';
    process.env.NEXUS_FEATURE_FLAGS = 'observability.healthDiagnostics=true';
    const env = readEnv();
    expect(env.nexusHome).toBe(path.resolve('/tmp/nexus-home'));
    expect(env.nexusDataDir).toBe(path.join(os.homedir(), 'nexus-data'));
    expect(env.workspaceDataDir).toBe(path.join(os.homedir(), 'custom/workspaces'));
    expect(env.defaultLocale).toBe('fr-FR');
    expect(env.crashReportingEnabled).toBe(true);
    expect(env.crashReportingUrl).toBe('https://ops.example.com/crash');
    expect(env.featureFlagsFile).toBe(path.join(os.homedir(), 'flags.json'));
    expect(env.featureFlagsUrl).toBe('https://ops.example.com/flags.json');
    expect(env.featureFlags).toBe('observability.healthDiagnostics=true');
  });

  it('rejects invalid locale values', () => {
    process.env.NEXUS_LOCALE = 'invalid locale';
    expect(() => readEnv()).toThrow(/Invalid NEXUS_LOCALE/);
  });

  it('allows explicitly disabling crash reporting when an endpoint is configured', () => {
    process.env.NEXUS_CRASH_REPORTING_URL = 'https://ops.example.com/crash';
    process.env.NEXUS_CRASH_REPORTING_ENABLED = 'false';
    const env = readEnv();
    expect(env.crashReportingEnabled).toBe(false);
    expect(env.crashReportingUrl).toBe('https://ops.example.com/crash');
  });

  it('rejects invalid crash reporting settings', () => {
    process.env.NEXUS_CRASH_REPORTING_URL = 'not a url';
    expect(() => readEnv()).toThrow(/Invalid NEXUS_CRASH_REPORTING_URL/);

    process.env.NEXUS_CRASH_REPORTING_URL = 'https://ops.example.com/crash';
    process.env.NEXUS_CRASH_REPORTING_TIMEOUT_MS = '0';
    expect(() => readEnv()).toThrow(/Invalid NEXUS_CRASH_REPORTING_TIMEOUT_MS/);

    process.env.NEXUS_CRASH_REPORTING_TIMEOUT_MS = '5000';
    process.env.NEXUS_FEATURE_FLAGS_URL = 'not a url';
    expect(() => readEnv()).toThrow(/Invalid NEXUS_FEATURE_FLAGS_URL/);
  });
});
