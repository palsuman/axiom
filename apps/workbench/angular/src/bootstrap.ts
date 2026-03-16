import { ApplicationRef, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { WorkbenchShellComponent } from './app/components/workbench-shell/workbench-shell.component';
import { NEXUS_WORKBENCH_BRIDGE, resolveAngularWorkbenchBridge } from './app/providers/nexus-bridge.token';

export function ensureAngularWorkbenchHost(documentRef: Document = document) {
  const existing = documentRef.querySelector('nexus-angular-root');

  if (existing instanceof HTMLElement) {
    return existing;
  }

  const host = documentRef.createElement('nexus-angular-root');
  documentRef.body.append(host);
  return host;
}

export async function bootstrapAngularWorkbench(
  documentRef: Document = document,
  browserWindow: Window & typeof globalThis = window
): Promise<ApplicationRef> {
  ensureAngularWorkbenchHost(documentRef);

  return bootstrapApplication(WorkbenchShellComponent, {
    providers: [
      provideZonelessChangeDetection(),
      {
        provide: NEXUS_WORKBENCH_BRIDGE,
        useValue: resolveAngularWorkbenchBridge(browserWindow)
      }
    ]
  });
}
