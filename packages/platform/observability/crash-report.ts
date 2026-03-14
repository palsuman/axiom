import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import type { NexusEnv } from '../config/env';

export type CrashReport = {
  id: string;
  timestamp: string;
  source: string;
  reason: string;
  stack: string;
  processType: 'main' | 'renderer' | 'worker';
  runtime: {
    nexusEnv: NexusEnv['nexusEnv'];
    locale: string;
    platform: string;
    release: string;
    arch: string;
    nodeVersion: string;
  };
};

export type CrashReportOptions = {
  source: string;
  error: unknown;
  env: NexusEnv;
  timestamp?: string;
  cwd?: string;
  platform?: string;
  release?: string;
  arch?: string;
  nodeVersion?: string;
  processType?: CrashReport['processType'];
};

export function createCrashReport(options: CrashReportOptions): CrashReport {
  const timestamp = options.timestamp ?? new Date().toISOString();
  const replacements = createPathRedactions(options.env, options.cwd ?? process.cwd());
  return {
    id: randomUUID(),
    timestamp,
    source: options.source,
    reason: sanitizeCrashText(extractCrashReason(options.error), replacements),
    stack: sanitizeCrashText(extractCrashStack(options.error), replacements),
    processType: options.processType ?? 'main',
    runtime: {
      nexusEnv: options.env.nexusEnv,
      locale: options.env.defaultLocale,
      platform: options.platform ?? process.platform,
      release: options.release ?? os.release(),
      arch: options.arch ?? process.arch,
      nodeVersion: options.nodeVersion ?? process.version
    }
  };
}

export function extractCrashReason(error: unknown) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || error.toString();
  if (typeof error === 'object') {
    const maybe = (error as { message?: string }).message;
    if (maybe) return maybe;
  }
  return JSON.stringify(error);
}

export function extractCrashStack(error: unknown) {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  if (typeof error === 'object' && error && 'stack' in error) {
    return String((error as { stack: unknown }).stack);
  }
  return 'No stack trace available';
}

type PathRedaction = {
  value: string;
  token: string;
};

function createPathRedactions(env: NexusEnv, cwd: string): PathRedaction[] {
  return [
    { value: env.workspaceDataDir, token: '<workspace-data-dir>' },
    { value: env.nexusDataDir, token: '<nexus-data-dir>' },
    { value: env.nexusHome, token: '<nexus-home>' },
    { value: cwd, token: '<cwd>' },
    { value: os.homedir(), token: '<user-home>' }
  ]
    .map(candidate => ({ ...candidate, value: path.resolve(candidate.value) }))
    .sort((left, right) => right.value.length - left.value.length);
}

function sanitizeCrashText(value: string, replacements: readonly PathRedaction[]) {
  return replacements.reduce((current, replacement) => replaceAllVariants(current, replacement), value);
}

function replaceAllVariants(input: string, replacement: PathRedaction) {
  return buildPathVariants(replacement.value).reduce((current, variant) => current.split(variant).join(replacement.token), input);
}

function buildPathVariants(value: string) {
  const normalized = path.resolve(value);
  return Array.from(
    new Set([
      normalized,
      normalized.replace(/\\/g, '/'),
      normalized.replace(/\//g, '\\'),
      `file://${normalized.replace(/\\/g, '/')}`
    ])
  );
}
