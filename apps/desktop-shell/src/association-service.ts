import { app } from 'electron';
import path from 'node:path';
import type { NexusEnv } from '@nexus/platform/env';
import { log, logError } from './logger';
import { resolveWorkspacePath } from './workspace-path';
import type { WorkspaceLaunchRequest } from './window-manager';

export class AssociationService {
  constructor(private readonly env: NexusEnv) {}

  registerProtocolHandlers() {
    if (this.env.nexusEnv === 'test') {
      return;
    }
    try {
      const args = this.getProtocolRegistrationArgs();
      if (app.isDefaultProtocolClient('nexus', process.execPath, args)) {
        log('Protocol handler already registered for nexus:// links');
        return;
      }
      const registered = app.setAsDefaultProtocolClient('nexus', process.execPath, args);
      if (!registered) {
        log('Electron could not register nexus:// protocol handler (likely lacking permissions)');
      } else {
        log('Registered nexus:// protocol handler');
      }
    } catch (error) {
      logError('Failed to register protocol handler', error);
    }
  }

  parseDeepLink(rawUrl: string, cwd = process.cwd()): WorkspaceLaunchRequest | null {
    if (!rawUrl || !rawUrl.startsWith('nexus://')) return null;
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch (error) {
      logError('Invalid deep link', error);
      return null;
    }
    if (url.protocol !== 'nexus:') return null;
    const action = (url.hostname || url.pathname.replace(/^\//, '')).trim().toLowerCase();
    if (!action || action === 'open' || action === 'workspace') {
      const workspacePath = this.extractWorkspacePath(url);
      if (!workspacePath) return null;
      return {
        path: resolveWorkspacePath(workspacePath, cwd),
        forceNew: url.searchParams.get('window') === 'new'
      };
    }
    return null;
  }

  private extractWorkspacePath(url: URL) {
    const direct = url.searchParams.get('workspace');
    if (direct) return decodeURIComponent(direct);
    const host = url.hostname.toLowerCase();
    if ((host === 'open' || host === 'workspace') && url.pathname.length > 1) {
      return decodeURIComponent(url.pathname);
    }
    const pathSegments = url.pathname.split('/').filter(Boolean);
    if (pathSegments.length >= 2 && pathSegments[0].toLowerCase() === 'open') {
      return decodeURIComponent('/' + pathSegments.slice(1).join('/'));
    }
    if (pathSegments.length && !url.hostname) {
      return decodeURIComponent('/' + pathSegments.join('/'));
    }
    return null;
  }

  private getProtocolRegistrationArgs() {
    if (process.platform === 'win32') {
      const exe = process.execPath;
      const appPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
      return appPath ? [appPath] : [exe];
    }
    return undefined;
  }
}
