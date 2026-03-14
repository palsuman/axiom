import { app, dialog, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { NexusEnv } from '@nexus/platform/config/env';
import { log, logError } from './logger';
import type { WindowManager } from '../windowing/window-manager';

type ElectronApp = typeof app;

type CrashDependencies = {
  app?: ElectronApp;
  dialog?: typeof dialog;
  shell?: typeof shell;
  fs?: typeof fs;
  now?: () => Date;
};

export class CrashService {
  private readonly crashDir: string;
  private readonly crashFile: string;
  private handling = false;
  private readonly electronApp: ElectronApp;
  private readonly dialogApi: typeof dialog;
  private readonly shellApi: typeof shell;
  private readonly fsApi: typeof fs;
  private readonly now: () => Date;

  constructor(
    private readonly env: NexusEnv,
    private readonly windowManager: WindowManager,
    deps: CrashDependencies = {}
  ) {
    this.electronApp = deps.app ?? app;
    this.dialogApi = deps.dialog ?? dialog;
    this.shellApi = deps.shell ?? shell;
    this.fsApi = deps.fs ?? fs;
    this.now = deps.now ?? (() => new Date());
    this.crashDir = path.join(this.env.nexusDataDir ?? this.env.nexusHome, 'logs');
    this.crashFile = path.join(this.crashDir, 'crash.log');
  }

  initialize() {
    process.on('uncaughtException', error => this.captureCrash('uncaughtException', error));
    process.on('unhandledRejection', reason => this.captureCrash('unhandledRejection', reason));
    this.electronApp.on('render-process-gone', (_event, details) => {
      this.captureCrash('render-process-gone', details);
    });
  }

  captureCrash(source: string, error: unknown) {
    if (this.handling) {
      log('Additional crash detected while handling another crash');
      return;
    }
    this.handling = true;
    const info = this.formatCrashInfo(source, error);
    this.persistCrashInfo(info);
    const choice = this.dialogApi.showMessageBoxSync({
      type: 'error',
      buttons: ['Restart Nexus', 'Quit', 'Open Crash Log'],
      defaultId: 0,
      cancelId: 1,
      title: 'Nexus crashed',
      message: 'Nexus encountered a fatal error and needs to restart.',
      detail: `${info.reason}\nLast log: ${this.crashFile}`
    });
    if (choice === 2) {
      this.shellApi.openPath(this.crashFile);
      this.handling = false;
      return;
    }
    if (choice === 0) {
      this.restart();
    } else {
      this.exitWithFailure();
    }
  }

  private restart() {
    try {
      this.windowManager.persistSessions();
    } catch (error) {
      logError('Failed to persist sessions before restart', error);
    }
    this.electronApp.relaunch();
    this.electronApp.exit(0);
  }

  private exitWithFailure() {
    this.electronApp.exit(1);
  }

  private formatCrashInfo(source: string, error: unknown) {
    const timestamp = this.now().toISOString();
    const reason = typeof error === 'string' ? error : this.extractErrorMessage(error);
    const stack = this.extractStack(error);
    return { timestamp, source, reason, stack };
  }

  private extractErrorMessage(error: unknown) {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message || error.toString();
    if (typeof error === 'object') {
      const maybe = (error as { message?: string }).message;
      if (maybe) return maybe;
    }
    return JSON.stringify(error);
  }

  private extractStack(error: unknown) {
    if (error instanceof Error && error.stack) {
      return error.stack;
    }
    if (typeof error === 'object' && error && 'stack' in error) {
      return String((error as { stack: unknown }).stack);
    }
    return 'No stack trace available';
  }

  private persistCrashInfo(info: { timestamp: string; source: string; reason: string; stack: string }) {
    try {
      this.fsApi.mkdirSync(this.crashDir, { recursive: true });
      const entry = `\n[${info.timestamp}] source=${info.source}\n${info.reason}\n${info.stack}\n`;
      this.fsApi.appendFileSync(this.crashFile, entry, 'utf8');
      log(`Crash info written to ${this.crashFile}`);
    } catch (error) {
      logError('Failed to write crash log', error);
    }
  }
}

