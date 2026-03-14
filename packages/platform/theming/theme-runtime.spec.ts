import { createDefaultThemeRegistry } from './theme-registry';
import {
  ThemeRuntime,
  createDefaultThemeRuntime,
  toMonacoThemeDefinition,
  toTerminalThemeDefinition
} from './theme-runtime';

describe('ThemeRuntime', () => {
  it('uses the selected registry theme as the active snapshot and exposes non-color tokens', () => {
    const runtime = createDefaultThemeRuntime({ initialThemeId: 'Nexus Light' });
    const snapshot = runtime.getSnapshot();

    expect(snapshot.activeThemeId).toBe('Nexus Light');
    expect(snapshot.colors['editor.background']).toBe('#ffffff');
    expect(snapshot.typography['font.family.ui']).toContain('IBM Plex Sans');
    expect(snapshot.icons['icon.size.md']).toBe('16px');
    expect(snapshot.layout['activityBar.width']).toBe('56px');
    expect(snapshot.cssVariables['--nexus-editor-background']).toBe('#ffffff');
    expect(snapshot.cssVariables['--nexus-font-size-md']).toBe('13px');
    expect(snapshot.cssVariables['--nexus-icon-size-md']).toBe('16px');
  });

  it('layers overrides in default, user, workspace, and contrast order across token sections', () => {
    const runtime = createDefaultThemeRuntime({ initialThemeId: 'Nexus Dark' });
    runtime.setOverrides('default', {
      colors: { 'panel.background': '#202020' },
      spacing: { 'space.4': '10px' }
    });
    runtime.setOverrides('user', {
      colors: { 'panel.background': '#303030' },
      icons: { 'icon.size.md': '18px' }
    });
    runtime.setOverrides('workspace', {
      colors: { 'panel.background': '#404040' },
      layout: { 'activityBar.width': '60px' }
    });
    runtime.setOverrides('contrast', {
      colors: { 'panel.background': '#505050' }
    });

    const snapshot = runtime.getSnapshot();

    expect(snapshot.colors['panel.background']).toBe('#505050');
    expect(snapshot.spacing['space.4']).toBe('10px');
    expect(snapshot.icons['icon.size.md']).toBe('18px');
    expect(snapshot.layout['activityBar.width']).toBe('60px');
    expect(snapshot.overrides.workspace.layout?.['activityBar.width']).toBe('60px');
  });

  it('emits changes when theme id or override layers change', () => {
    const runtime = createDefaultThemeRuntime();
    const reasons: Array<string> = [];
    runtime.onDidChange(event => {
      reasons.push(event.scope ? `${event.reason}:${event.scope}` : event.reason);
    });

    runtime.setTheme('Nexus Light');
    runtime.setOverrides('workspace', { colors: { 'statusBar.background': '#123456' } });
    runtime.clearOverrides('workspace');

    expect(reasons).toEqual(['theme', 'overrides:workspace', 'overrides:workspace']);
  });

  it('falls back to the configured fallback theme when the requested theme is missing', () => {
    const runtime = createDefaultThemeRuntime({
      initialThemeId: 'Missing Theme',
      fallbackThemeId: 'Nexus High Contrast'
    });

    expect(runtime.getSnapshot().activeThemeId).toBe('Nexus High Contrast');
  });

  it('derives Monaco and terminal definitions from the active runtime snapshot', () => {
    const registry = createDefaultThemeRegistry();
    registry.register({
      id: 'Nexus Twilight',
      label: 'Nexus Twilight',
      kind: 'dark',
      extends: 'Nexus Dark',
      colors: {
        'editor.background': '#101820',
        'editor.foreground': '#f8f9fa',
        'editor.lineNumberForeground': '#8b949e',
        'editor.cursorForeground': '#58a6ff',
        'terminal.background': '#0d1117',
        'terminal.foreground': '#c9d1d9',
        'terminalCursor.foreground': '#58a6ff',
        'terminal.selectionBackground': '#264f78'
      },
      typography: {
        'font.family.mono': "'JetBrains Mono', monospace",
        'font.size.md': '14px',
        'font.lineHeight.normal': '1.6'
      }
    });
    const runtime = new ThemeRuntime({ registry, initialThemeId: 'Nexus Twilight' });
    const snapshot = runtime.getSnapshot();

    expect(toMonacoThemeDefinition(snapshot)).toMatchObject({
      base: 'vs-dark',
      background: '#101820',
      foreground: '#f8f9fa',
      lineNumber: '#8b949e',
      cursor: '#58a6ff',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 14,
      lineHeight: 22
    });
    expect(toTerminalThemeDefinition(snapshot)).toMatchObject({
      background: '#0d1117',
      foreground: '#c9d1d9',
      cursor: '#58a6ff',
      selectionBackground: '#264f78',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 14,
      lineHeight: 22
    });
  });

  it('rejects invalid override slots and malformed values', () => {
    const runtime = createDefaultThemeRuntime();
    const invalidColorOverrides = {
      colors: { 'nope.invalid': '#000000' }
    } as unknown as Parameters<typeof runtime.setOverrides>[1];

    expect(() =>
      runtime.setOverrides('user', invalidColorOverrides)
    ).toThrow(/unknown color slot/);

    expect(() =>
      runtime.setOverrides('user', {
        typography: { 'font.size.md': 'gigantic' }
      })
    ).toThrow(/invalid typography value/);

    expect(() =>
      runtime.setOverrides('user', {
        layout: { 'activityBar.width': 'wide' }
      })
    ).toThrow(/invalid layout value/);
  });
});
