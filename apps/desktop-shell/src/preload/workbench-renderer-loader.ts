import path from 'node:path';
import { registerNexusModuleAliases } from '../runtime/nexus-module-alias';

export function resolveWorkbenchRendererEntryPath(preloadDir = __dirname) {
  return path.resolve(preloadDir, '../../../../../workbench/apps/workbench/src/shell/workbench-dom-renderer.js');
}

export function mountWorkbenchRenderer(
  preloadDir = __dirname,
  loadModule: (entryPath: string) => { mountWorkbenchDom(container?: HTMLElement): { dispose(): void } } = entryPath =>
    require(entryPath)
) {
  const start = () => {
    try {
      registerNexusModuleAliases(preloadDir);
      const entryPath = resolveWorkbenchRendererEntryPath(preloadDir);
      const module = loadModule(entryPath);
      module.mountWorkbenchDom(document.body);
    } catch (error) {
      console.error('[desktop-shell] failed to mount workbench renderer', error);
      document.body.innerHTML = `
        <main style="font-family: system-ui, sans-serif; padding: 32px; color: #f5f5f5; background: #111; min-height: 100vh; box-sizing: border-box;">
          <h1 style="margin: 0 0 12px;">Nexus IDE</h1>
          <p style="margin: 0 0 8px; opacity: 0.82;">The Electron shell started, but the renderer failed to load.</p>
          <pre style="white-space: pre-wrap; background: rgba(255,255,255,0.06); border-radius: 12px; padding: 16px;">${escapeHtml(
            error instanceof Error ? error.stack ?? error.message : String(error)
          )}</pre>
        </main>
      `;
    }
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
