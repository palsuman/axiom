# Terminal Platform (IDE-060)

## Goals
- Provide a secure PTY-backed terminal surface that launches the user's default shell, respects workspace context, and streams data efficiently to the renderer.
- Keep the implementation modular so that future work (splits, search, AI assistance) can reuse the same contracts.

## Architecture

### Desktop Shell
- `apps/desktop-shell/src/terminal-service.ts`
  - Wraps `node-pty` and tracks terminals per window session + webContents id.
  - Emits `data` and `exit` events that are forwarded over IPC (`nexus:terminal:data`, `nexus:terminal:exit`) only to the owning renderer.
  - Supports create/write/resize/dispose plus session teardown handling (`disposeBySession`).
- IPC handlers in `apps/desktop-shell/src/main.ts`
  - `nexus:terminal:create`, `write`, `resize`, `dispose` map directly to the service.
  - Session removal automatically closes orphan PTYs to prevent leaks.

### Preload Bridge
- `apps/desktop-shell/src/preload.ts`
  - Exposes promise-based helpers (`terminalCreate`, `terminalWrite`, etc.).
  - Provides event hooks `onTerminalData` / `onTerminalExit` that multiplex renderer listeners and keep the bridge typed.

### Renderer
- `apps/workbench/src/terminal-client.ts`
  - Thin wrapper around the preload bridge for easier mocking in tests.
- `apps/workbench/src/terminal-host.ts`
  - Uses `xterm` + `fit` addon to render a terminal surface inside the workbench panel area.
  - Handles theme awareness, resizing, cleanup, and forwards keyboard input to the PTY.
- `apps/workbench/src/main.ts`
  - Mounts a default terminal surface when running in a browser context and wires lifecycle disposal.
  - Registers Git/terminal commands so panels and future UI can control commit and history features consistently.

## Contracts
Defined in `packages/contracts/ipc.ts`:

```ts
type TerminalCreatePayload = {
  sessionId?: string;
  cols: number;
  rows: number;
  cwd?: string;
  shell?: string;
  env?: Record<string, string>;
};

type TerminalDescriptor = {
  terminalId: string;
  pid: number;
  shell: string;
  cwd?: string;
};
```

Events: `TerminalDataEvent` + `TerminalExitEvent`.

## Acceptance Criteria
- Creating a terminal spawns the OS-default shell (respecting overrides) and streams output/input without blocking the main thread.
- Resizing the window propagates new cols/rows to the PTY and xterm instance using `fit`.
- Closing a window or switching workspaces disposes PTYs, preventing stray processes.
