import { AngularIconThemeHostService } from './angular-icon-theme-host.service';
import { AngularThemeHostService } from './angular-theme-host.service';

describe('AngularIconThemeHostService', () => {
  it('binds icon theming to the shared Angular theme runtime', () => {
    const themeHost = new AngularThemeHostService();
    const iconHost = new AngularIconThemeHostService(themeHost);

    expect(iconHost.snapshot().activeThemeId).toBe('Nexus Dark');
    expect(iconHost.snapshot().iconTheme).toBe('dark');

    themeHost.applyTheme('Nexus High Contrast');

    expect(iconHost.snapshot().activeThemeId).toBe('Nexus High Contrast');
    expect(iconHost.snapshot().iconTheme).toBe('highContrast');
  });

  it('updates cache stats when resolving themed icons and file icons', () => {
    const iconHost = new AngularIconThemeHostService(new AngularThemeHostService());

    iconHost.resolveIcon('icon.fallback');
    iconHost.resolveFileIcon('package.json');

    expect(iconHost.snapshot().cacheStats.iconMisses).toBe(1);
    expect(iconHost.snapshot().cacheStats.fileMisses).toBe(1);
    expect(iconHost.snapshot().registeredIconIds).toEqual(
      expect.arrayContaining(['icon.codicon.search', 'icon.file.typescript', 'icon.folder.src'])
    );
  });
});
