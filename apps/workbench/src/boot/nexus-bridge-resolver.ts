type NexusBridge = NonNullable<Window['nexus']>;

export function resolveNexusBridge<TBridge extends object = NexusBridge>() {
  if (typeof window !== 'undefined' && window.nexus) {
    return window.nexus as TBridge;
  }

  const preloadBridge = (globalThis as typeof globalThis & {
    __NEXUS_PRELOAD_BRIDGE__?: NexusBridge;
  }).__NEXUS_PRELOAD_BRIDGE__;

  if (preloadBridge) {
    return preloadBridge as TBridge;
  }

  return undefined;
}
