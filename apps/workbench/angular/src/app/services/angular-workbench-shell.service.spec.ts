import { INITIAL_ANGULAR_WORKBENCH_SHELL_MODEL } from '../models/angular-workbench-shell.model';
import { AngularWorkbenchShellService } from './angular-workbench-shell.service';

describe('AngularWorkbenchShellService', () => {
  it('returns degraded state when the preload bridge is unavailable', async () => {
    const layoutService = createLayoutServiceStub();
    const service = new AngularWorkbenchShellService(null, layoutService as never, {
      theme: jest.fn(() => 'Nexus Dark')
    } as never);

    await expect(service.load()).resolves.toEqual({
      ...INITIAL_ANGULAR_WORKBENCH_SHELL_MODEL,
      env: 'unknown',
      platform: 'unknown',
      bridgeAvailable: false,
      status: 'degraded',
      message: 'Electron bridge unavailable. Angular shell is running in standalone mode.',
      locale: 'en-US',
      supportedLocales: ['en-US', 'fr-FR', 'es-ES'],
      activeThemeId: 'Nexus Dark',
      shell: INITIAL_ANGULAR_WORKBENCH_SHELL_MODEL.shell
    });
    expect(layoutService.initialize).toHaveBeenCalledWith({
      env: 'unknown',
      platform: 'unknown',
      bridgeAvailable: false
    });
  });

  it('returns ready state when preload bridge metadata is available', async () => {
    const layoutService = createLayoutServiceStub();
    const service = new AngularWorkbenchShellService(
      {
        getEnv: jest.fn().mockResolvedValue({
          env: 'development',
          platform: 'darwin'
        })
      },
      layoutService as never,
      {
        theme: jest.fn(() => 'Nexus Dark')
      } as never
    );

    await expect(service.load()).resolves.toEqual({
      renderer: 'angular',
      env: 'development',
      platform: 'darwin',
      bridgeAvailable: true,
      status: 'ready',
      message: 'Angular workbench shell is active and rendering the migrated layout path.',
      locale: 'en-US',
      supportedLocales: ['en-US', 'fr-FR', 'es-ES'],
      activeThemeId: 'Nexus Dark',
      shell: INITIAL_ANGULAR_WORKBENCH_SHELL_MODEL.shell
    });
    expect(layoutService.initialize).toHaveBeenCalledWith({
      env: 'development',
      platform: 'darwin',
      bridgeAvailable: true
    });
  });
});

function createLayoutServiceStub() {
  return {
    initialize: jest.fn(),
    locale: jest.fn(() => 'en-US'),
    supportedLocales: jest.fn(() => ['en-US', 'fr-FR', 'es-ES']),
    snapshot: jest.fn(() => INITIAL_ANGULAR_WORKBENCH_SHELL_MODEL.shell)
  };
}
