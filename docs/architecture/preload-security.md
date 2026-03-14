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
- Declare `Window.nexus` typings so TypeScript-aware renderers use the safe surface.

## Usage Example
```ts
const env = await window.nexus.getEnv();
window.nexus.log({ level: 'info', message: `Renderer boot in ${env.nexusEnv}` });
```

## Next Steps
- Tighten renderer sandboxing and CSP enforcement on top of the validated IPC surface.
- Extend contracts for AI/chat communications after IDE-076.
