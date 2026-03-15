import { resolveNexusBridge } from './nexus-bridge-resolver';

describe('resolveNexusBridge', () => {
  const originalWindow = global.window;
  const originalPreloadBridge = global.__NEXUS_PRELOAD_BRIDGE__;

  afterEach(() => {
    if (originalWindow === undefined) {
      Reflect.deleteProperty(global, 'window');
    } else {
      global.window = originalWindow;
    }

    if (originalPreloadBridge === undefined) {
      Reflect.deleteProperty(global, '__NEXUS_PRELOAD_BRIDGE__');
    } else {
      global.__NEXUS_PRELOAD_BRIDGE__ = originalPreloadBridge;
    }
  });

  it('prefers the renderer window bridge when available', () => {
    const windowBridge = { gitListRepositories: jest.fn() };
    const preloadBridge = { gitListRepositories: jest.fn() };

    global.window = { nexus: windowBridge } as unknown as Window & typeof globalThis;
    global.__NEXUS_PRELOAD_BRIDGE__ = preloadBridge as never;

    expect(resolveNexusBridge()).toBe(windowBridge);
  });

  it('falls back to the preload-local bridge when mounted from preload', () => {
    const preloadBridge = { gitListRepositories: jest.fn() };

    global.window = {} as Window & typeof globalThis;
    global.__NEXUS_PRELOAD_BRIDGE__ = preloadBridge as never;

    expect(resolveNexusBridge()).toBe(preloadBridge);
  });

  it('returns undefined when neither bridge is available', () => {
    global.window = {} as Window & typeof globalThis;
    Reflect.deleteProperty(global, '__NEXUS_PRELOAD_BRIDGE__');

    expect(resolveNexusBridge()).toBeUndefined();
  });
});
