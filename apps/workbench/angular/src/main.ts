import { bootstrapAngularWorkbench } from './bootstrap';
import { ANGULAR_RENDERER_FAILED_EVENT, ANGULAR_RENDERER_READY_EVENT } from '@nexus/contracts/renderer';

export async function startAngularWorkbench(
  bootstrap = bootstrapAngularWorkbench,
  browserWindow: Window & typeof globalThis = window,
  reportError: (message?: unknown, ...optionalParams: unknown[]) => void = console.error
) {
  try {
    await bootstrap(document, browserWindow);
    browserWindow.dispatchEvent(new CustomEvent(ANGULAR_RENDERER_READY_EVENT));
  } catch (error) {
    reportError('[workbench-angular] failed to bootstrap angular renderer', error);
    browserWindow.dispatchEvent(new CustomEvent(ANGULAR_RENDERER_FAILED_EVENT, { detail: error }));
    throw error;
  }
}

void startAngularWorkbench().catch(() => undefined);
