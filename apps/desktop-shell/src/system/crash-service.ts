import { app, dialog, shell } from 'electron';
import type { NexusEnv } from '@nexus/platform/config/env';
import { log, logError } from './logger';
import { CrashReporter } from './crash-reporting';
import type { WindowManager } from '../windowing/window-manager';

type ElectronApp = typeof app;

type CrashDependencies = {
  app?: ElectronApp;
  dialog?: typeof dialog;
  shell?: typeof shell;
  now?: () => Date;
  reporter?: Pick<CrashReporter, 'capture' | 'submit'>;
};

export class CrashService {
  private handling = false;
  private readonly electronApp: ElectronApp;
  private readonly dialogApi: typeof dialog;
  private readonly shellApi: typeof shell;
  private readonly reporter: Pick<CrashReporter, 'capture' | 'submit'>;

  constructor(
    private readonly env: NexusEnv,
    private readonly windowManager: WindowManager,
    deps: CrashDependencies = {}
  ) {
    this.electronApp = deps.app ?? app;
    this.dialogApi = deps.dialog ?? dialog;
    this.shellApi = deps.shell ?? shell;
    this.reporter = deps.reporter ?? new CrashReporter(this.env, { now: deps.now });
  }

  initialize() {
    process.on('uncaughtException', error => {
      void this.captureCrash('uncaughtException', error);
    });
    process.on('unhandledRejection', reason => {
      void this.captureCrash('unhandledRejection', reason);
    });
    this.electronApp.on('render-process-gone', (_event, details) => {
      void this.captureCrash('render-process-gone', details);
    });
  }

  async captureCrash(source: string, error: unknown) {
    if (this.handling) {
      log('Additional crash detected while handling another crash');
      return;
    }
    this.handling = true;
    try {
      const capture = this.reporter.capture(source, error);
      const choice = this.dialogApi.showMessageBoxSync({
        type: 'error',
        buttons: capture.submitAvailable
          ? ['Send Report and Restart Nexus', 'Restart Nexus', 'Quit', 'Open Crash Log']
          : ['Restart Nexus', 'Quit', 'Open Crash Log'],
        defaultId: 0,
        cancelId: capture.submitAvailable ? 2 : 1,
        title: 'Nexus crashed',
        message: 'Nexus encountered a fatal error and needs to restart.',
        detail: `${capture.report.reason}\nLast log: ${capture.localPath}`
      });

      if (capture.submitAvailable) {
        if (choice === 0) {
          await this.reporter.submit(capture.report);
          this.restart();
          return;
        }
        if (choice === 1) {
          this.restart();
          return;
        }
        if (choice === 2) {
          this.exitWithFailure();
          return;
        }
        this.shellApi.openPath(capture.localPath);
        return;
      }

      if (choice === 2) {
        this.shellApi.openPath(capture.localPath);
        return;
      }
      if (choice === 0) {
        this.restart();
        return;
      }
      this.exitWithFailure();
    } finally {
      this.handling = false;
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
}
