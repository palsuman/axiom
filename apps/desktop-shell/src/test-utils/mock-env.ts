import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { NexusEnv } from '@nexus/platform/config/env';

export function createMockEnv(overrides: Partial<NexusEnv> = {}): NexusEnv {
  const tmpHome = overrides.nexusHome ?? fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-home-'));
  const dataDir = overrides.nexusDataDir ?? tmpHome;
  const workspaceDir = overrides.workspaceDataDir ?? path.join(dataDir, 'workspaces');
  const base: NexusEnv = {
    nexusEnv: 'development',
    logLevel: 'info',
    defaultLocale: 'en-US',
    nexusHome: tmpHome,
    nexusDataDir: dataDir,
    workspaceDataDir: workspaceDir,
    updateChannel: 'stable',
    updateFeedUrl: undefined,
    autoUpdateEnabled: false,
    crashReportingEnabled: false,
    crashReportingUrl: undefined,
    crashReportingTimeoutMs: 5000,
    featureFlagsFile: path.join(dataDir, 'config', 'feature-flags.json'),
    featureFlagsUrl: undefined,
    featureFlags: undefined
  };
  return { ...base, ...overrides };
}
