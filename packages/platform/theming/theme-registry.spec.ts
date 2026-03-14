import {
  BUILTIN_THEME_MANIFESTS,
  THEME_COLOR_SLOTS,
  createDefaultThemeRegistry,
  ThemeRegistry,
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

  it('resolves inherited manifests deterministically with css variables', () => {
    const registry = createDefaultThemeRegistry();
    registry.register({
      id: 'Nexus Twilight',
      label: 'Nexus Twilight',
      kind: 'dark',
      extends: 'Nexus Dark',
      colors: {
        'panel.background': '#101820',
        'statusBar.background': '#6f42c1'
      }
    });

    const resolved = registry.resolve('Nexus Twilight');

    expect(resolved.inheritanceChain).toEqual(['Nexus Dark', 'Nexus Twilight']);
    expect(resolved.colors['workbench.background']).toBe('#1e1e1e');
    expect(resolved.colors['panel.background']).toBe('#101820');
    expect(resolved.cssVariables['--nexus-panel-bg']).toBe('#101820');
    expect(resolved.cssVariables['--nexus-status-bar-bg']).toBe('#6f42c1');
  });

  it('fills missing tokens from kind defaults when a theme does not extend another manifest', () => {
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
    expect(resolved.uiBaseTheme).toBe('vs');
  });

  it('exports a strict manifest schema fixture', () => {
    const registry = createDefaultThemeRegistry();
    const schema = registry.toJSONSchema();

    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['id', 'label', 'kind', 'colors']);
    expect((schema.properties.colors as { propertyNames: { enum: string[] } }).propertyNames.enum).toEqual([
      ...THEME_COLOR_SLOTS
    ]);
  });

  it('rejects duplicate ids, unknown parents, invalid slots, and malformed colors', () => {
    const registry = createDefaultThemeRegistry();

    expect(() =>
      registry.register({
        id: 'Nexus Dark',
        label: 'Duplicate Dark',
        kind: 'dark',
        colors: {}
      })
    ).toThrow(/already registered/);

    expect(() =>
      registry.register({
        id: 'Broken Parent',
        label: 'Broken Parent',
        kind: 'dark',
        extends: 'Missing Theme',
        colors: {}
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

    const invalidSlotManifest = {
      id: 'Broken Slot',
      label: 'Broken Slot',
      kind: 'dark',
      colors: {
        'not.real.slot': '#000000'
      }
    } as unknown as ThemeManifest;

    expect(() => registry.register(invalidSlotManifest)).toThrow(/unknown color slot/);
  });

  it('detects inheritance cycles while resolving', () => {
    const registry = new ThemeRegistry();
    registry.register({
      id: 'Cycle A',
      label: 'Cycle A',
      kind: 'dark',
      colors: {}
    });
    registry.register({
      id: 'Cycle B',
      label: 'Cycle B',
      kind: 'dark',
      extends: 'Cycle A',
      colors: {}
    });

    const cycleA = registry.get('Cycle A');
    if (!cycleA) {
      throw new Error('Expected Cycle A to exist');
    }
    Object.assign(cycleA, { extends: 'Cycle B' });

    expect(() => registry.resolve('Cycle A')).toThrow(/inheritance cycle/);
  });
});
