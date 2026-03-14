import os from 'node:os';
import path from 'node:path';

const VALID_ENVS = ['development', 'production', 'test'] as const;
const VALID_LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;
const VALID_CHANNELS = ['stable', 'beta', 'dev'] as const;
const DEFAULT_LOCALE = 'en-US';

export type NexusEnv = {
  nexusEnv: (typeof VALID_ENVS)[number];
  logLevel: (typeof VALID_LOG_LEVELS)[number];
  defaultLocale: string;
  nexusHome: string;
  nexusDataDir: string;
  workspaceDataDir: string;
  updateChannel: (typeof VALID_CHANNELS)[number];
  updateFeedUrl?: string;
  autoUpdateEnabled: boolean;
};

function getEnumEnv<T extends readonly string[]>(key: string, allowed: T, fallback: T[number]): T[number] {
  const raw = process.env[key];
  const candidate = raw && raw.trim().length ? raw.trim().toLowerCase() : fallback;
  if (!allowed.includes(candidate as T[number])) {
    throw new Error(`Invalid ${key}: ${raw}`);
  }
  return candidate as T[number];
}

function getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function resolveDir(value: string | undefined, fallback: string) {
  const raw = value && value.trim().length ? value.trim() : fallback;
  return toAbsolutePath(raw);
}

function toAbsolutePath(location: string) {
  const expanded = location.startsWith('~/') ? path.join(os.homedir(), location.slice(2)) : location;
  return path.isAbsolute(expanded) ? path.resolve(expanded) : path.join(os.homedir(), expanded);
}

function normalizeLocale(value: string | undefined) {
  if (!value || !value.trim()) return DEFAULT_LOCALE;
  const normalized = value.trim().replace('_', '-');
  if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(normalized)) {
    throw new Error(`Invalid NEXUS_LOCALE: ${value}`);
  }
  return normalized;
}

export function readEnv(): NexusEnv {
  const nexusEnv = getEnumEnv('NEXUS_ENV', VALID_ENVS, 'development');
  const logLevel = getEnumEnv('LOG_LEVEL', VALID_LOG_LEVELS, 'info');
  const defaultLocale = normalizeLocale(process.env.NEXUS_LOCALE);
  const nexusHome = resolveDir(process.env.NEXUS_HOME, '.nexus');
  const nexusDataDir = resolveDir(process.env.NEXUS_DATA_DIR, nexusHome);
  const workspaceDefault = path.join(nexusDataDir, 'workspaces');
  const workspaceDataDir = resolveDir(process.env.NEXUS_WORKSPACE_DATA, workspaceDefault);
  const updateChannel = getEnumEnv('NEXUS_UPDATE_CHANNEL', VALID_CHANNELS, 'stable');
  const updateFeedUrl = process.env.NEXUS_UPDATE_URL;
  const autoUpdateEnabled = getEnvBool('NEXUS_AUTO_UPDATE', nexusEnv === 'production');
  return {
    nexusEnv,
    logLevel,
    defaultLocale,
    nexusHome,
    nexusDataDir,
    workspaceDataDir,
    updateChannel,
    updateFeedUrl,
    autoUpdateEnabled
  };
}
