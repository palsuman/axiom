import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ANGULAR_RENDERER_FAILED_EVENT, ANGULAR_RENDERER_READY_EVENT } from '@nexus/contracts/renderer';
import { registerNexusModuleAliases } from '../runtime/nexus-module-alias';

export const ANGULAR_RENDERER_TIMEOUT_MS = 5_000;

interface AngularRendererAssetPaths {
  browserRoot: string;
  mainScriptPath: string;
  polyfillsScriptPath: string;
  stylesPath: string;
}

interface MountWorkbenchRendererOptions {
  documentRef?: Document;
  windowRef?: Window & typeof globalThis;
  fileExists?: (entryPath: string) => boolean;
  timeoutMs?: number;
}

export function resolveAngularRendererAssetPaths(preloadDir = __dirname): AngularRendererAssetPaths {
  const browserRoot = path.resolve(preloadDir, '../../../../../workbench/angular/browser');

  return {
    browserRoot,
    mainScriptPath: path.join(browserRoot, 'main.js'),
    polyfillsScriptPath: path.join(browserRoot, 'polyfills.js'),
    stylesPath: path.join(browserRoot, 'styles.css')
  };
}

export function mountWorkbenchRenderer(
  preloadDir = __dirname,
  {
    documentRef = document,
    windowRef = window,
    fileExists = entryPath => fs.existsSync(entryPath),
    timeoutMs = ANGULAR_RENDERER_TIMEOUT_MS
  }: MountWorkbenchRendererOptions = {}
) {
  const start = async () => {
    registerNexusModuleAliases(preloadDir);

    try {
      await mountAngularRenderer(preloadDir, documentRef, windowRef, fileExists, timeoutMs);
    } catch (angularError) {
      renderFailureScreen(
        documentRef,
        new Error(
          `${errorMessage(angularError)}\n\nAngular is the canonical renderer path. The legacy DOM renderer has been removed.`
        )
      );
    }
  };

  if (documentRef.readyState === 'loading') {
    windowRef.addEventListener('DOMContentLoaded', () => {
      void start();
    }, { once: true });
    return;
  }

  void start();
}

async function mountAngularRenderer(
  preloadDir: string,
  documentRef: Document,
  windowRef: Window & typeof globalThis,
  fileExists: (entryPath: string) => boolean,
  timeoutMs: number
) {
  const assets = resolveAngularRendererAssetPaths(preloadDir);

  for (const assetPath of [assets.mainScriptPath, assets.polyfillsScriptPath, assets.stylesPath]) {
    if (!fileExists(assetPath)) {
      throw new Error(`Missing Angular renderer asset: ${assetPath}`);
    }
  }

  documentRef.body.innerHTML = '<nexus-angular-root></nexus-angular-root>';
  ensureStylesheet(documentRef, assets.stylesPath);

  await loadModuleScript(documentRef, assets.polyfillsScriptPath);

  const readyPromise = waitForAngularReady(windowRef, timeoutMs);
  await Promise.all([readyPromise, loadModuleScript(documentRef, assets.mainScriptPath)]);
}

function ensureStylesheet(documentRef: Document, stylesheetPath: string) {
  const href = pathToFileURL(stylesheetPath).toString();
  const existing = documentRef.querySelector(`link[data-nexus-angular-style="true"][href="${href}"]`);
  if (existing) {
    return;
  }

  const link = documentRef.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('href', href);
  link.setAttribute('data-nexus-angular-style', 'true');
  documentRef.head.append(link);
}

function loadModuleScript(documentRef: Document, scriptPath: string): Promise<void> {
  const src = pathToFileURL(scriptPath).toString();
  const existing = documentRef.querySelector(`script[data-nexus-angular-script="true"][src="${src}"]`);
  if (existing) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = documentRef.createElement('script');
    script.setAttribute('type', 'module');
    script.setAttribute('src', src);
    script.setAttribute('data-nexus-angular-script', 'true');
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load Angular renderer script: ${scriptPath}`)), {
      once: true
    });
    documentRef.body.append(script);
  });
}

function waitForAngularReady(windowRef: Window & typeof globalThis, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = windowRef.setTimeout(() => {
      cleanup();
      reject(new Error(`Angular renderer did not signal readiness within ${timeoutMs}ms`));
    }, timeoutMs);

    const onReady = () => {
      cleanup();
      resolve();
    };

    const onFailed = (event: Event) => {
      cleanup();
      const detail = event instanceof CustomEvent ? event.detail : undefined;
      reject(detail instanceof Error ? detail : new Error(String(detail ?? 'Angular renderer bootstrap failed')));
    };

    const cleanup = () => {
      windowRef.clearTimeout(timeout);
      windowRef.removeEventListener(ANGULAR_RENDERER_READY_EVENT, onReady);
      windowRef.removeEventListener(ANGULAR_RENDERER_FAILED_EVENT, onFailed as EventListener);
    };

    windowRef.addEventListener(ANGULAR_RENDERER_READY_EVENT, onReady, { once: true });
    windowRef.addEventListener(ANGULAR_RENDERER_FAILED_EVENT, onFailed as EventListener, { once: true });
  });
}

function renderFailureScreen(documentRef: Document, error: unknown) {
  console.error('[desktop-shell] failed to mount workbench renderer', error);
  documentRef.body.innerHTML = `
    <main style="font-family: system-ui, sans-serif; padding: 32px; color: #f5f5f5; background: #111; min-height: 100vh; box-sizing: border-box;">
      <h1 style="margin: 0 0 12px;">Nexus IDE</h1>
      <p style="margin: 0 0 8px; opacity: 0.82;">The Electron shell started, but the renderer failed to load.</p>
      <pre style="white-space: pre-wrap; background: rgba(255,255,255,0.06); border-radius: 12px; padding: 16px;">${escapeHtml(
        error instanceof Error ? error.stack ?? error.message : String(error)
      )}</pre>
    </main>
  `;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
