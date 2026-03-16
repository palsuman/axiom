import { InjectionToken } from '@angular/core';
import type { AngularWorkbenchBridge } from '../types/nexus-bridge';

export const NEXUS_WORKBENCH_BRIDGE = new InjectionToken<AngularWorkbenchBridge | null>('NEXUS_WORKBENCH_BRIDGE');

export function resolveAngularWorkbenchBridge(
  browserWindow: Window & typeof globalThis = window
): AngularWorkbenchBridge | null {
  const candidate = Reflect.get(browserWindow, 'nexus');

  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  if (typeof (candidate as AngularWorkbenchBridge).getEnv !== 'function') {
    return null;
  }

  return candidate as AngularWorkbenchBridge;
}
