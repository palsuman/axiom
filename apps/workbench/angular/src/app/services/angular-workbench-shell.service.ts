import { Inject, Injectable } from '@angular/core';
import { INITIAL_ANGULAR_WORKBENCH_SHELL_MODEL, type AngularWorkbenchShellModel } from '../models/angular-workbench-shell.model';
import { NEXUS_WORKBENCH_BRIDGE } from '../providers/nexus-bridge.token';
import type { AngularWorkbenchBridge } from '../types/nexus-bridge';
import { AngularThemeHostService } from './angular-theme-host.service';
import { AngularWorkbenchLayoutService } from './angular-workbench-layout.service';

@Injectable({ providedIn: 'root' })
export class AngularWorkbenchShellService {
  constructor(
    @Inject(NEXUS_WORKBENCH_BRIDGE) private readonly bridge: AngularWorkbenchBridge | null,
    private readonly layoutService: AngularWorkbenchLayoutService,
    private readonly themeHost: AngularThemeHostService
  ) {}

  async load(): Promise<AngularWorkbenchShellModel> {
    if (this.bridge === null) {
      this.layoutService.initialize({
        env: 'unknown',
        platform: 'unknown',
        bridgeAvailable: false
      });

      return {
        ...INITIAL_ANGULAR_WORKBENCH_SHELL_MODEL,
        env: 'unknown',
        platform: 'unknown',
        bridgeAvailable: false,
        status: 'degraded',
        message: 'Electron bridge unavailable. Angular shell is running in standalone mode.',
        locale: this.layoutService.locale(),
        supportedLocales: this.layoutService.supportedLocales(),
        activeThemeId: this.themeHost.theme(),
        shell: this.layoutService.snapshot()
      };
    }

    const snapshot = await this.bridge.getEnv();
    this.layoutService.initialize({
      env: snapshot.env,
      platform: snapshot.platform,
      bridgeAvailable: true
    });

    return {
      renderer: 'angular',
      env: snapshot.env,
      platform: snapshot.platform,
      bridgeAvailable: true,
      status: 'ready',
      message: 'Angular workbench shell is active and rendering the migrated layout path.',
      locale: this.layoutService.locale(),
      supportedLocales: this.layoutService.supportedLocales(),
      activeThemeId: this.themeHost.theme(),
      shell: this.layoutService.snapshot()
    };
  }
}
