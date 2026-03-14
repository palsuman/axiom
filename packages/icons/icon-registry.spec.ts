import { DEFAULT_FALLBACK_ICON, IconDefinition } from './icon-types';
import { IconRegistry } from './icon-registry';

describe('IconRegistry', () => {
  const sampleIcon: IconDefinition = {
    id: 'icon.typescript.file',
    version: 1,
    label: 'TypeScript file',
    kind: 'file-icon',
    tags: ['ts', 'typescript'],
    variants: {
      light: {
        cssClasses: ['file-icon', 'file-icon-ts-light'],
        foreground: '#3178c6'
      },
      dark: {
        cssClasses: ['file-icon', 'file-icon-ts-dark'],
        foreground: '#9cdcfe'
      }
    }
  };

  it('registers and resolves theme-specific icons with caching', () => {
    const registry = new IconRegistry();
    registry.registerIcon(sampleIcon);

    const darkResult = registry.resolveIcon(sampleIcon.id, 'dark');
    const repeated = registry.resolveIcon(sampleIcon.id, 'dark');

    expect(darkResult).toBe(repeated);
    expect(darkResult.variant.cssClasses).toContain('file-icon-ts-dark');
    expect(darkResult.theme).toBe('dark');
    expect(darkResult.isFallback).toBe(false);
  });

  it('falls back to default icon when definition is missing', () => {
    const telemetry = {
      onResolveMiss: jest.fn(),
      onResolve: jest.fn()
    };
    const registry = new IconRegistry({ telemetry });

    const result = registry.resolveIcon('unknown.icon', 'light');

    expect(result.definition.id).toBe(DEFAULT_FALLBACK_ICON.id);
    expect(result.isFallback).toBe(true);
    expect(telemetry.onResolveMiss).toHaveBeenCalledWith('unknown.icon');
    expect(telemetry.onResolve).toHaveBeenCalled();
  });

  it('prevents duplicate registration unless override is allowed', () => {
    const registry = new IconRegistry();
    registry.registerIcon(sampleIcon);

    expect(() => registry.registerIcon(sampleIcon)).toThrow('already registered');

    expect(() => registry.registerIcon({ ...sampleIcon, version: 2 }, { allowOverride: true })).not.toThrow();
  });

  it('supports alias resolution and cache invalidation on overrides', () => {
    const registry = new IconRegistry();
    registry.registerIcon(sampleIcon);
    registry.registerAlias('ts', sampleIcon.id);

    const firstResolution = registry.resolveIcon('ts');
    expect(firstResolution.definition.id).toBe(sampleIcon.id);

    const updatedIcon: IconDefinition = {
      ...sampleIcon,
      version: 2,
      variants: {
        light: { cssClasses: ['file-icon', 'updated-ts'], foreground: '#0000ff' }
      }
    };

    registry.registerIcon(updatedIcon, { allowOverride: true });
    const secondResolution = registry.resolveIcon('ts');

    expect(secondResolution).not.toBe(firstResolution);
    expect(secondResolution.definition.version).toBe(2);
    expect(secondResolution.variant.cssClasses).toContain('updated-ts');
  });

  it('throws when variants are missing or alias loops occur', () => {
    const registry = new IconRegistry();

    expect(() =>
      registry.registerIcon({
        id: 'broken.icon',
        version: 1,
        label: 'Broken',
        kind: 'custom-class',
        variants: {}
      })
    ).toThrow('must define at least one variant');

    registry.registerIcon(sampleIcon, { allowOverride: true });
    registry.registerAlias('loop-a', 'loop-b');
    registry.registerAlias('loop-b', 'loop-a');

    expect(() => registry.resolveIcon('loop-a')).toThrow('Alias resolution loop');
  });
});
