import fs from 'node:fs';
import Module from 'node:module';
import path from 'node:path';

type ResolveFilename = (request: string, parent: unknown, isMain: boolean, options?: unknown) => string;

const ALIAS_INSTALLED_FLAG = Symbol.for('nexus.desktopShell.aliasesInstalled');
const ALIAS_PACKAGE_ROOTS_FLAG = Symbol.for('nexus.desktopShell.aliasPackageRoots');

type GlobalAliasState = typeof globalThis & {
  [ALIAS_INSTALLED_FLAG]?: boolean;
  [ALIAS_PACKAGE_ROOTS_FLAG]?: string[];
};

const PREFIX_TO_PACKAGE = new Map<string, string>([
  ['@nexus/platform/', 'platform'],
  ['@nexus/contracts/', 'contracts'],
  ['@nexus/icons/', 'icons']
]);

function isRuntimePackagesRoot(candidatePath: string, exists: (candidatePath: string) => boolean) {
  return (
    exists(path.resolve(candidatePath, 'platform/config/env.js')) || exists(path.resolve(candidatePath, 'contracts/ipc.js'))
  );
}

export function resolveRuntimePackagesRoots(
  entryDir = __dirname,
  exists: (candidatePath: string) => boolean = fs.existsSync
) {
  const candidates = [
    path.resolve(entryDir, '../../..', 'packages'),
    path.resolve(process.cwd(), 'dist/apps/desktop-shell/packages'),
    path.resolve(process.cwd(), 'dist/apps/workbench/packages')
  ];
  return Array.from(new Set(candidates.filter(candidatePath => isRuntimePackagesRoot(candidatePath, exists))));
}

export function resolveAliasedModuleRequest(
  request: string,
  packageRoots: string[],
  resolveFilename: ResolveFilename,
  parent: unknown,
  isMain: boolean,
  options?: unknown
) {
  for (const [prefix, packageName] of PREFIX_TO_PACKAGE.entries()) {
    if (!request.startsWith(prefix)) {
      continue;
    }
    const relativePath = request.slice(prefix.length);
    let lastError: unknown;
    for (const packageRoot of packageRoots) {
      const mappedRequest = path.resolve(packageRoot, packageName, relativePath);
      try {
        return resolveFilename(mappedRequest, parent, isMain, options);
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) {
      throw lastError;
    }
  }
  return undefined;
}

export function registerNexusModuleAliases(
  entryDir = __dirname,
  exists: (candidatePath: string) => boolean = fs.existsSync
) {
  if (process.env.JEST_WORKER_ID) {
    return false;
  }
  const runtimePackageRoots = resolveRuntimePackagesRoots(entryDir, exists);
  if (!runtimePackageRoots.length) {
    return false;
  }
  const globalState = globalThis as GlobalAliasState;
  const mergedRoots = Array.from(new Set([...(globalState[ALIAS_PACKAGE_ROOTS_FLAG] ?? []), ...runtimePackageRoots]));
  globalState[ALIAS_PACKAGE_ROOTS_FLAG] = mergedRoots;
  if (globalState[ALIAS_INSTALLED_FLAG]) {
    return true;
  }

  const moduleApi = Module as unknown as { _resolveFilename: ResolveFilename };
  const originalResolveFilename = moduleApi._resolveFilename.bind(Module);
  moduleApi._resolveFilename = (request, parent, isMain, options) => {
    const aliasedRequest = resolveAliasedModuleRequest(
      request,
      globalState[ALIAS_PACKAGE_ROOTS_FLAG] ?? [],
      originalResolveFilename,
      parent,
      isMain,
      options
    );
    if (aliasedRequest) {
      return aliasedRequest;
    }
    return originalResolveFilename(request, parent, isMain, options);
  };

  globalState[ALIAS_INSTALLED_FLAG] = true;
  return true;
}
