declare module '../../../tools/scripts/lib/affected-config.js' {
  export function resolveBaseAndHead(env?: NodeJS.ProcessEnv): { base: string; head: string };
  export function buildAffectedArgs(env?: NodeJS.ProcessEnv, additionalTargets?: string[]): string[];
  export function getNxBinary(): string;
  export function getNxCommandArgs(baseCommand: string, nxArgs: string[]): string[];
}

declare module '../../../tools/cache/nexus-remote.js' {
  type RemoteOptions = {
    remoteDirEnv?: string;
    remoteDir?: string;
    defaultRemoteDir?: string;
  };

  type RemoteCache = {
    name: string;
    retrieve(hash: string, cacheDir: string): Promise<boolean>;
    store(hash: string, cacheDir: string): Promise<boolean>;
    resolveRemoteDir?: (options?: RemoteOptions) => string;
  };

  function setupRemoteCache(options?: RemoteOptions): RemoteCache;
  export = setupRemoteCache;
}
