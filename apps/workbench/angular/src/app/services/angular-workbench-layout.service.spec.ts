import { AngularThemeHostService } from './angular-theme-host.service';
import { AngularWorkbenchLayoutService } from './angular-workbench-layout.service';

describe('AngularWorkbenchLayoutService', () => {
  it('builds a shell snapshot with activities, sidebars, panel views, and status items', () => {
    const service = new AngularWorkbenchLayoutService(new AngularThemeHostService());

    service.initialize({
      env: 'development',
      platform: 'darwin',
      bridgeAvailable: true
    });

    const snapshot = service.snapshot();
    expect(snapshot.activityBar.items.map(item => item.id)).toEqual(
      expect.arrayContaining(['activity.explorer', 'activity.search', 'activity.chat'])
    );
    expect(snapshot.sidebar.views.map(view => view.id)).toEqual(
      expect.arrayContaining(['view.explorer', 'view.search', 'view.git'])
    );
    expect(snapshot.panel.views.map(view => view.id)).toEqual(
      expect.arrayContaining(['panel.terminal', 'panel.output', 'panel.problems'])
    );
    expect(snapshot.statusBar.items.map(item => item.id)).toEqual(
      expect.arrayContaining(['status.locale', 'status.theme', 'status.notifications', 'status.settings'])
    );
  });

  it('updates localization hooks and status items when cycling locale', () => {
    const service = new AngularWorkbenchLayoutService(new AngularThemeHostService());
    service.initialize();

    service.setLocale('fr-FR');

    expect(service.locale()).toBe('fr-FR');
    expect(service.snapshot().statusBar.items[0]?.text).toEqual(
      expect.objectContaining({ key: 'status.locale.current' })
    );
    expect(service.snapshot().notifications.locale).toBe('fr-FR');
  });

  it('supports panel docking and settings/editor integration', () => {
    const service = new AngularWorkbenchLayoutService(new AngularThemeHostService());
    service.initialize();

    service.setPanelPosition('right');
    service.openSettings();

    expect(service.snapshot().panel.position).toBe('right');
    expect(service.snapshot().editors.groups[0]?.tabs.map(tab => tab.resource)).toEqual(
      expect.arrayContaining(['nexus://settings'])
    );
  });
});
