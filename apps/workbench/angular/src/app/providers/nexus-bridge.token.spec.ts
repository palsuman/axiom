import { resolveAngularWorkbenchBridge } from './nexus-bridge.token';

describe('resolveAngularWorkbenchBridge', () => {
  it('returns null when the bridge is absent', () => {
    expect(resolveAngularWorkbenchBridge({} as Window & typeof globalThis)).toBeNull();
  });

  it('returns null when the bridge does not expose getEnv', () => {
    expect(resolveAngularWorkbenchBridge({ nexus: {} } as unknown as Window & typeof globalThis)).toBeNull();
  });

  it('returns the typed bridge when getEnv is available', () => {
    const bridge = {
      getEnv: jest.fn()
    };

    expect(resolveAngularWorkbenchBridge({ nexus: bridge } as unknown as Window & typeof globalThis)).toBe(bridge);
  });
});
