import path from 'node:path';

import { buildWindowWebPreferences, resolvePreloadScriptPath } from './window-manager';

describe('window manager preload path', () => {
  it('prefers the sibling preload output for compiled desktop-shell sources', () => {
    const windowingDir = '/tmp/dist/apps/desktop-shell/apps/desktop-shell/src/windowing';
    const expected = path.resolve(windowingDir, '../preload.js');

    const resolved = resolvePreloadScriptPath(windowingDir, candidatePath => candidatePath === expected);

    expect(resolved).toBe(expected);
  });

  it('falls back to a same-directory preload path for legacy output layouts', () => {
    const windowingDir = '/tmp/dist/apps/desktop-shell/windowing';
    const expected = path.resolve(windowingDir, 'preload.js');

    const resolved = resolvePreloadScriptPath(windowingDir, candidatePath => candidatePath === expected);

    expect(resolved).toBe(expected);
  });

  it('returns the sibling preload path when no candidate currently exists', () => {
    const windowingDir = '/tmp/dist/apps/desktop-shell/apps/desktop-shell/src/windowing';

    const resolved = resolvePreloadScriptPath(windowingDir, () => false);

    expect(resolved).toBe(path.resolve(windowingDir, '../preload.js'));
  });

  it('builds isolated but non-sandboxed web preferences for the modular preload output', () => {
    const webPreferences = buildWindowWebPreferences({
      preloadPath: '/tmp/dist/apps/desktop-shell/apps/desktop-shell/src/preload.js',
      additionalArguments: ['--workspace=%2Ftmp%2Fworkspace']
    });

    expect(webPreferences).toEqual({
      preload: '/tmp/dist/apps/desktop-shell/apps/desktop-shell/src/preload.js',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: ['--workspace=%2Ftmp%2Fworkspace']
    });
  });
});
