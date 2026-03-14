# Preload & IPC Security (IDE-010)

## Contracts
- Channels defined in `packages/contracts/ipc.ts`.
- All renderer-native communication must go through these typed contracts.

## Main Process Enforcement
- `ipcMain.handle('nexus:get-env')` returns sanitized environment data only.
- Shared schema enforcement now lives in `packages/contracts/ipc-validation.ts`.
- `apps/desktop-shell/src/bootstrap/bootstrap-desktop-shell.ts` validates every payload-bearing IPC channel before touching windows, files, Git, terminals, or workspace backups.
- Invalid payloads are rejected and logged through the desktop logger for auditability.

## Preload Responsibilities
- `apps/desktop-shell/src/preload.ts` is the entrypoint; `apps/desktop-shell/src/preload/nexus-bridge.ts` exposes the minimal API:
  - `window.nexus.getEnv()` → returns `GetEnvResponse` via `ipcRenderer.invoke`.
  - `window.nexus.log({ level, message })` → sends structured logs.
- Main-process validation and IPC registration live in `apps/desktop-shell/src/bootstrap/bootstrap-desktop-shell.ts`, keeping the bridge implementation separate from native privilege decisions.
- `contextIsolation: true` and `nodeIntegration: false` guarantee renderer cannot access Node APIs directly.
- `BrowserWindow` currently sets `sandbox: false` for the preload context because the desktop shell ships the preload as modular TypeScript output (`preload.js` + sibling modules) rather than a single bundled script. This preserves the secure renderer boundary while keeping local preload module loading functional.
- Preload-time `@nexus/*` module resolution searches both compiled app package trees so workbench renderer modules can resolve shared runtime dependencies from `dist/apps/workbench/packages` while the desktop shell keeps using `dist/apps/desktop-shell/packages`.
- Declare `Window.nexus` typings so TypeScript-aware renderers use the safe surface.

## Usage Example
```ts
const env = await window.nexus.getEnv();
window.nexus.log({ level: 'info', message: `Renderer boot in ${env.nexusEnv}` });
```

## Next Steps
- Bundle the preload into a single file, then re-enable Electron preload sandboxing on top of the validated IPC surface and CSP enforcement.
- Extend contracts for AI/chat communications after IDE-076.
