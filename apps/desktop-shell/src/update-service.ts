import { autoUpdater, type Event as ElectronEvent } from 'electron';
import type { NexusEnv } from '@nexus/platform/env';
import { log, logError } from './logger';

type ElectronAutoUpdater = typeof autoUpdater;

const DEFAULT_FEED_BASE = 'https://updates.nexus.dev';

export class UpdateService {
  private readonly enabled: boolean;
  private initialized = false;

  constructor(private readonly env: NexusEnv, private readonly updater: ElectronAutoUpdater = autoUpdater) {
    this.enabled = env.autoUpdateEnabled && env.nexusEnv === 'production';
  }

  initialize() {
    if (!this.enabled) {
      log('Auto-update disabled for current environment');
      return;
    }
    try {
      const feedUrl = this.getFeedUrl();
      if (feedUrl) {
        this.updater.setFeedURL({ url: feedUrl });
        log(`Auto-update feed configured for ${feedUrl}`);
      }
      this.attachLogging();
      this.initialized = true;
      this.checkForUpdates(false);
    } catch (error) {
      logError('Failed to initialize auto-update', error);
    }
  }

  checkForUpdates(manual = true) {
    if (!this.initialized) {
      log('Auto-update check skipped; updater not initialized');
      return false;
    }
    try {
      this.updater.checkForUpdates();
      if (manual) {
        log('Manual update check requested');
      }
      return true;
    } catch (error) {
      logError('Failed to check for updates', error);
      return false;
    }
  }

  quitAndInstall() {
    if (!this.initialized) {
      log('Auto-update install skipped; updater not initialized');
      return false;
    }
    try {
      this.updater.quitAndInstall();
      return true;
    } catch (error) {
      logError('Failed to quit and install update', error);
      return false;
    }
  }

  private attachLogging() {
    const forward = (status: string) => () => log(`[auto-update] ${status}`);
    this.updater.on('checking-for-update', forward('checking for updates'));
    this.updater.on('update-available', forward('update available'));
    this.updater.on('update-not-available', forward('no updates'));
    const anyUpdater = this.updater as unknown as {
      on(event: string, listener: (...args: any[]) => void): ElectronAutoUpdater;
    };
    anyUpdater.on('download-progress', (_event: ElectronEvent, info: { percent?: number }) => {
      const percent = typeof info.percent === 'number' ? info.percent : 0;
      log(`[auto-update] download progress ${Math.round(percent)}%`);
    });
    this.updater.on('update-downloaded', forward('update downloaded'));
    this.updater.on('error', error => logError('[auto-update] error', error));
  }

  private getFeedUrl() {
    if (this.env.updateFeedUrl) {
      return this.env.updateFeedUrl;
    }
    return `${DEFAULT_FEED_BASE}/${this.env.updateChannel}`;
  }
}
