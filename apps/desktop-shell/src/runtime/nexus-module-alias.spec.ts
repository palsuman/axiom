import path from 'node:path';

import {
  registerNexusModuleAliases,
  resolveAliasedModuleRequest,
  resolveRuntimePackagesRoots
} from './nexus-module-alias';

describe('nexus module alias runtime resolver', () => {
  it('resolves packages roots from the compiled desktop-shell source layout', () => {
    const entryDir = '/tmp/dist/apps/desktop-shell/apps/desktop-shell/src';
    const expected = [path.resolve('/tmp/dist/apps/desktop-shell/packages')];

    const resolved = resolveRuntimePackagesRoots(entryDir, candidatePath =>
      candidatePath === path.resolve(expected[0], 'platform/config/env.js')
    );

    expect(resolved).toEqual(expected);
  });

  it('adds the workbench dist packages root when available', () => {
    const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue('/workspace/nexus');
    const expected = ['/workspace/nexus/dist/apps/desktop-shell/packages', '/workspace/nexus/dist/apps/workbench/packages'];
    try {
      const resolved = resolveRuntimePackagesRoots('/tmp/missing', candidatePath =>
        candidatePath === path.resolve(expected[0], 'platform/config/env.js') ||
        candidatePath === path.resolve(expected[1], 'platform/config/env.js')
      );
      expect(resolved).toEqual(expected);
    } finally {
      cwdSpy.mockRestore();
    }
  });

  it('falls back to the workbench packages root when the desktop-shell packages do not contain a module', () => {
    const packageRoots = ['/workspace/nexus/dist/apps/desktop-shell/packages', '/workspace/nexus/dist/apps/workbench/packages'];
    const request = '@nexus/platform/theming/theme-registry';
    const resolved = resolveAliasedModuleRequest(
      request,
      packageRoots,
      candidateRequest => {
        if (candidateRequest === path.resolve(packageRoots[0], 'platform/theming/theme-registry')) {
          const error = new Error(`Cannot find module '${candidateRequest}'`) as Error & { code?: string };
          error.code = 'MODULE_NOT_FOUND';
          throw error;
        }
        return `${candidateRequest}.js`;
      },
      undefined,
      false
    );

    expect(resolved).toBe(`${path.resolve(packageRoots[1], 'platform/theming/theme-registry')}.js`);
  });

  it('does not patch module aliases in jest environments', () => {
    const result = registerNexusModuleAliases('/tmp/dist/apps/desktop-shell/apps/desktop-shell/src', () => true);
    expect(result).toBe(false);
  });
});
