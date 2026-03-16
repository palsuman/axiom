import { createDefaultThemeRuntime } from '@nexus/platform/theming/theme-runtime';
import { BUILTIN_FILE_ICON_THEME } from './file-icon-mappings';
import { createDefaultIconThemeService, IconThemeService } from './icon-theme-service';
import type { IconDefinition } from './icon-types';

describe('IconThemeService', () => {
  const sampleIcon: IconDefinition = {
    id: 'icon.file.custom-typescript',
    version: 1,
    label: 'TypeScript file',
    kind: 'file-icon',
    variants: {
      light: { cssClasses: ['file-icon', 'ts-light'], foreground: '#3178c6' },
      dark: { cssClasses: ['file-icon', 'ts-dark'], foreground: '#9cdcfe' },
      highContrast: { cssClasses: ['file-icon', 'ts-hc'], foreground: '#ffffff' }
    }
  };

  it('binds to the shared theme runtime and invalidates caches on theme change', () => {
    const runtime = createDefaultThemeRuntime({ initialThemeId: 'Nexus Dark' });
    const telemetry = {
      onCacheInvalidated: jest.fn(),
      onThemeChange: jest.fn()
    };
    const service = new IconThemeService({ themeRuntime: runtime, telemetry });
    service.registerIcon(sampleIcon);

    const darkResult = service.resolveIcon(sampleIcon.id);
    expect(darkResult.theme).toBe('dark');

    runtime.setTheme('Nexus High Contrast');

    const highContrastResult = service.resolveIcon(sampleIcon.id);
    expect(highContrastResult.theme).toBe('highContrast');
    expect(highContrastResult).not.toBe(darkResult);
    expect(service.getSnapshot().activeThemeId).toBe('Nexus High Contrast');
    expect(service.getSnapshot().iconTokens['icon.size.md']).toBe('16px');
    expect(telemetry.onCacheInvalidated).toHaveBeenCalled();
    expect(telemetry.onThemeChange).toHaveBeenCalled();
  });

  it('records icon cache hits and misses through telemetry', () => {
    const telemetry = {
      onCacheHit: jest.fn(),
      onCacheMiss: jest.fn()
    };
    const service = createDefaultIconThemeService({ telemetry });
    service.registerIcon(sampleIcon);

    const first = service.resolveIcon(sampleIcon.id);
    const second = service.resolveIcon(sampleIcon.id);

    expect(second).toBe(first);
    expect(service.getSnapshot().cacheStats.iconMisses).toBe(1);
    expect(service.getSnapshot().cacheStats.iconHits).toBe(1);
    expect(telemetry.onCacheMiss).toHaveBeenCalledTimes(1);
    expect(telemetry.onCacheHit).toHaveBeenCalledTimes(1);
  });

  it('tracks file icon cache behavior and invalidates when the file icon theme changes', () => {
    const service = createDefaultIconThemeService();

    const first = service.resolveFileIcon({ fileName: 'package.json' });
    const second = service.resolveFileIcon({ fileName: 'package.json' });

    expect(first).toBe(second);
    expect(service.getSnapshot().cacheStats.fileMisses).toBe(1);
    expect(service.getSnapshot().cacheStats.fileHits).toBe(1);

    service.setFileIconTheme({
      ...BUILTIN_FILE_ICON_THEME,
      files: {
        ...BUILTIN_FILE_ICON_THEME.files,
        byFileName: {
          ...BUILTIN_FILE_ICON_THEME.files.byFileName,
          'package.json': 'icon.file.package-json-alt'
        }
      }
    });

    const third = service.resolveFileIcon({ fileName: 'package.json' });
    expect(third).toEqual({ iconId: 'icon.file.package-json-alt', reason: 'file-name' });
    expect(service.getSnapshot().cacheStats.invalidations).toBeGreaterThan(0);
  });
});
