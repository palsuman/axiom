import { INITIAL_ANGULAR_WORKBENCH_SHELL_MODEL } from '../../models/angular-workbench-shell.model';
import { AngularCommandHostService } from '../../services/angular-command-host.service';
import { AngularIconThemeHostService } from '../../services/angular-icon-theme-host.service';
import { AngularThemeHostService } from '../../services/angular-theme-host.service';
import { AngularWorkbenchLayoutService } from '../../services/angular-workbench-layout.service';
import { WorkbenchShellComponent } from './workbench-shell.component';

describe('WorkbenchShellComponent', () => {
  it('loads the angular workbench shell model into the signal state', async () => {
    const component = new WorkbenchShellComponent(
      {
        load: jest.fn().mockResolvedValue({
          ...INITIAL_ANGULAR_WORKBENCH_SHELL_MODEL,
          env: 'development',
          platform: 'darwin',
          bridgeAvailable: true,
          status: 'ready',
          message: 'Angular workbench shell is active and rendering the migrated layout path.'
        })
      } as never,
      new AngularCommandHostService(),
      createIconHostStub(),
      createLayoutServiceStub(),
      createThemeHostStub()
    );

    component.ngOnInit();
    await Promise.resolve();

    expect(component.model()).toEqual(
      expect.objectContaining({
        renderer: 'angular',
        env: 'development',
        platform: 'darwin',
        bridgeAvailable: true,
        status: 'ready'
      })
    );
    expect(component.model().shell.activityBar.width).toBeGreaterThan(0);
  });

  it('routes shell interactions through the angular layout and command hosts', () => {
    const layoutService = createLayoutServiceStub();
    const component = new WorkbenchShellComponent(
      { load: jest.fn().mockResolvedValue(INITIAL_ANGULAR_WORKBENCH_SHELL_MODEL) } as never,
      new AngularCommandHostService(),
      createIconHostStub(),
      layoutService,
      createThemeHostStub()
    );

    component.showCommandPalette();
    expect(component.commandHost.palette().open).toBe(true);

    component.activateActivity('activity.search');
    component.activatePanelView('panel.output');
    component.openSettings();

    expect(layoutService.activateActivity).toHaveBeenCalledWith('activity.search');
    expect(layoutService.activatePanelView).toHaveBeenCalledWith('panel.output');
    expect(layoutService.openSettings).toHaveBeenCalled();
  });
});

function createIconHostStub() {
  return {
    resolveIcon: jest.fn(),
    resolveFileIcon: jest.fn(),
    snapshot: jest.fn(() => ({
      activeThemeId: 'Nexus Dark',
      iconTheme: 'dark',
      themeRevision: 0,
      iconTokens: {
        'icon.size.xs': '12px',
        'icon.size.sm': '14px',
        'icon.size.md': '16px',
        'icon.size.lg': '20px',
        'icon.size.xl': '24px'
      },
      cacheStats: {
        iconHits: 0,
        iconMisses: 0,
        fileHits: 0,
        fileMisses: 0,
        invalidations: 0
      },
      registeredIconIds: ['icon.fallback']
    }))
  } as unknown as AngularIconThemeHostService;
}

function createThemeHostStub() {
  return {
    initialize: jest.fn(),
    toggleTheme: jest.fn(),
    theme: jest.fn(() => 'Nexus Dark')
  } as unknown as AngularThemeHostService;
}

function createLayoutServiceStub() {
  return {
    snapshot: jest.fn(() => INITIAL_ANGULAR_WORKBENCH_SHELL_MODEL.shell),
    locale: jest.fn(() => 'en-US'),
    activateActivity: jest.fn(),
    activateSidebarView: jest.fn(),
    activatePanelView: jest.fn(),
    setPanelPosition: jest.fn(),
    togglePrimarySidebar: jest.fn(),
    cycleLocale: jest.fn(),
    openSettings: jest.fn(),
    focusEditor: jest.fn()
  } as unknown as AngularWorkbenchLayoutService;
}
