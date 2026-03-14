import {
  BUILTIN_THEME_MANIFESTS,
  THEME_COLOR_SLOTS,
  THEME_ICON_SLOTS,
  THEME_LAYOUT_SLOTS,
  THEME_SPACING_SLOTS,
  THEME_TYPOGRAPHY_SLOTS,
  ThemeRegistry,
  createDefaultThemeRegistry,
  type ThemeManifest
} from './theme-registry';

describe('ThemeRegistry', () => {
  it('registers built-in light, dark, and high-contrast themes', () => {
    const registry = createDefaultThemeRegistry();

    expect(registry.list().map(theme => theme.id)).toEqual([
      'Nexus Dark',
      'Nexus Light',
      'Nexus High Contrast'
    ]);
    expect(BUILTIN_THEME_MANIFESTS).toHaveLength(3);
  });

  it('resolves inherited manifests across colors, typography, spacing, icons, and layout tokens', () => {
    const registry = createDefaultThemeRegistry();
    registry.register({
      id: 'Nexus Twilight',
      label: 'Nexus Twilight',
      kind: 'dark',
      extends: 'Nexus Dark',
      colors: {
        'panel.background': '#101820',
        'statusBar.background': '#6f42c1'
      },
      typography: {
        'font.family.ui': "'Recursive Sans', sans-serif"
      },
      spacing: {
        'space.4': '10px'
      },
      icons: {
        'icon.size.md': '18px'
      },
      layout: {
        'activityBar.width': '60px'
      }
    });

    const resolved = registry.resolve('Nexus Twilight');

    expect(resolved.inheritanceChain).toEqual(['Nexus Dark', 'Nexus Twilight']);
    expect(resolved.colors['panel.background']).toBe('#101820');
    expect(resolved.typography['font.family.ui']).toBe("'Recursive Sans', sans-serif");
    expect(resolved.spacing['space.4']).toBe('10px');
    expect(resolved.icons['icon.size.md']).toBe('18px');
    expect(resolved.layout['activityBar.width']).toBe('60px');
    expect(resolved.cssVariables['--nexus-panel-background']).toBe('#101820');
    expect(resolved.cssVariables['--nexus-font-family-ui']).toBe("'Recursive Sans', sans-serif");
    expect(resolved.cssVariables['--nexus-space-4']).toBe('10px');
    expect(resolved.cssVariables['--nexus-icon-size-md']).toBe('18px');
    expect(resolved.cssVariables['--nexus-activity-bar-width']).toBe('60px');
  });

  it('fills missing token sections from defaults when a theme does not extend another manifest', () => {
    const registry = createDefaultThemeRegistry();
    registry.register({
      id: 'Nexus Minimal Light',
      label: 'Nexus Minimal Light',
      kind: 'light',
      colors: {
        'statusBar.background': '#004b91'
      }
    });

    const resolved = registry.resolve('Nexus Minimal Light');

    expect(resolved.colors['statusBar.background']).toBe('#004b91');
    expect(resolved.colors['editor.background']).toBe('#ffffff');
    expect(resolved.typography['font.size.md']).toBe('13px');
    expect(resolved.icons['icon.size.md']).toBe('16px');
    expect(resolved.layout['statusBar.height']).toBe('26px');
    expect(resolved.uiBaseTheme).toBe('vs');
  });

  it('exports a strict manifest schema fixture for every token section', () => {
    const registry = createDefaultThemeRegistry();
    const schema = registry.toJSONSchema();

    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['id', 'label', 'kind']);
    expect((schema.properties.colors as { propertyNames: { enum: string[] } }).propertyNames.enum).toEqual([
      ...THEME_COLOR_SLOTS
    ]);
    expect((schema.properties.typography as { propertyNames: { enum: string[] } }).propertyNames.enum).toEqual([
      ...THEME_TYPOGRAPHY_SLOTS
    ]);
    expect((schema.properties.spacing as { propertyNames: { enum: string[] } }).propertyNames.enum).toEqual([
      ...THEME_SPACING_SLOTS
    ]);
    expect((schema.properties.icons as { propertyNames: { enum: string[] } }).propertyNames.enum).toEqual([
      ...THEME_ICON_SLOTS
    ]);
    expect((schema.properties.layout as { propertyNames: { enum: string[] } }).propertyNames.enum).toEqual([
      ...THEME_LAYOUT_SLOTS
    ]);
  });

  it('rejects duplicate ids, unknown parents, invalid slots, and malformed token values', () => {
    const registry = createDefaultThemeRegistry();

    expect(() =>
      registry.register({
        id: 'Nexus Dark',
        label: 'Duplicate Dark',
        kind: 'dark'
      })
    ).toThrow(/already registered/);

    expect(() =>
      registry.register({
        id: 'Broken Parent',
        label: 'Broken Parent',
        kind: 'dark',
        extends: 'Missing Theme'
      })
    ).toThrow(/extends unknown theme/);

    expect(() =>
      registry.register({
        id: 'Broken Color',
        label: 'Broken Color',
        kind: 'dark',
        colors: {
          'sidebar.background': 'nope'
        }
      })
    ).toThrow(/invalid color value/);

    expect(() =>
      registry.register({
        id: 'Broken Typography',
        label: 'Broken Typography',
        kind: 'dark',
        typography: {
          'font.size.md': 'giant'
        }
      })
    ).toThrow(/invalid typography value/);

    expect(() =>
      registry.register({
        id: 'Broken Layout',
        label: 'Broken Layout',
        kind: 'dark',
        layout: {
          'activityBar.width': 'wide'
        }
      })
    ).toThrow(/invalid layout value/);

    const invalidSlotManifest = {
      id: 'Broken Slot',
      label: 'Broken Slot',
      kind: 'dark',
      spacing: {
        'not.real.slot': '4px'
      }
    } as unknown as ThemeManifest;

    expect(() => registry.register(invalidSlotManifest)).toThrow(/unknown spacing slot/);
  });

  it('detects inheritance cycles while resolving', () => {
    const registry = new ThemeRegistry();
    registry.register({
      id: 'Cycle A',
      label: 'Cycle A',
      kind: 'dark'
    });
    registry.register({
      id: 'Cycle B',
      label: 'Cycle B',
      kind: 'dark',
      extends: 'Cycle A'
    });

    const cycleA = registry.get('Cycle A');
    if (!cycleA) {
      throw new Error('Expected Cycle A to exist');
    }
    Object.assign(cycleA, { extends: 'Cycle B' });

    expect(() => registry.resolve('Cycle A')).toThrow(/inheritance cycle/);
  });
});
