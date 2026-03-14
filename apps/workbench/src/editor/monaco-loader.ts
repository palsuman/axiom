import type { AMDRequire, MonacoApi, MonacoEnvironment } from './monaco-types';

export interface MonacoLoaderOptions {
  basePath?: string;
  workerPath?: string;
}

export interface MonacoLoaderEnvironment {
  loadScript(url: string): Promise<void>;
  getGlobal(): { require?: AMDRequire; MonacoEnvironment?: MonacoEnvironment } | undefined;
}

const DEFAULT_BASE = '/monaco/vs';

const defaultEnv: MonacoLoaderEnvironment = {
  loadScript(url: string) {
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        reject(new Error('Monaco scripts can only be loaded in a browser context'));
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.addEventListener('load', () => resolve());
      script.addEventListener('error', () => reject(new Error(`Failed to load Monaco from ${url}`)));
      document.body.appendChild(script);
    });
  },
  getGlobal: () =>
    typeof window === 'undefined'
      ? undefined
      : (window as unknown as { require?: AMDRequire; MonacoEnvironment?: MonacoEnvironment })
};

export class MonacoLoader {
  private monacoInstance?: MonacoApi;
  private pending?: Promise<MonacoApi>;

  constructor(
    private readonly options: MonacoLoaderOptions = {},
    private readonly env: MonacoLoaderEnvironment = defaultEnv
  ) {}

  isLoaded() {
    return !!this.monacoInstance;
  }

  async load(): Promise<MonacoApi> {
    if (this.monacoInstance) {
      return this.monacoInstance;
    }
    if (this.pending) {
      return this.pending;
    }
    const global = this.env.getGlobal();
    if (!global) {
      throw new Error('Monaco requires a browser environment');
    }
    const basePath = this.options.basePath ?? DEFAULT_BASE;
    const loaderUrl = `${basePath}/loader.js`;
    this.pending = this.env
      .loadScript(loaderUrl)
      .then(() => this.initialize(global, basePath))
      .finally(() => {
        this.pending = undefined;
      });
    return this.pending;
  }

  private initialize(global: { require?: AMDRequire; MonacoEnvironment?: MonacoEnvironment }, basePath: string) {
    const amd = global.require;
    if (!amd || typeof amd !== 'function' || typeof amd.config !== 'function') {
      throw new Error('AMD loader unavailable after loading Monaco scripts');
    }
    amd.config({ paths: { vs: basePath } });
    this.configureEnvironment(global, basePath);
    return new Promise<MonacoApi>((resolve, reject) => {
      amd(
        ['vs/editor/editor.main'],
        (monaco: MonacoApi) => {
          this.monacoInstance = monaco;
          resolve(monaco);
        },
        error => reject(error ?? new Error('Failed to bootstrap Monaco editor'))
      );
    });
  }

  private configureEnvironment(global: { MonacoEnvironment?: MonacoEnvironment }, basePath: string) {
    const workerPath = this.options.workerPath ?? `${basePath}/base/worker/workerMain.js`;
    const workerSnippet = `
      self.MonacoEnvironment = { baseUrl: '${basePath}/' };
      importScripts('${workerPath}');
    `;
    global.MonacoEnvironment = {
      getWorkerUrl: () => `data:text/javascript;charset=utf-8,${encodeURIComponent(workerSnippet)}`
    };
  }
}
