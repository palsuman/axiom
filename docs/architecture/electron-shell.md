# Electron Shell (IDE-009–IDE-011)

## Main Process
- Entry: `apps/desktop-shell/src/main.ts`, which delegates to `apps/desktop-shell/src/bootstrap/bootstrap-desktop-shell.ts`.
- Startup installs runtime `@nexus/*` module alias resolution to compiled `dist/apps/desktop-shell/packages/*` outputs before loading bootstrap code, so Node can execute shared platform/contracts modules from compiled JavaScript.
- Responsibilities: initialize Electron app, enforce single-instance lock, restore previous windows via `WindowManager`, register IPC handlers, parse CLI/open-file events into workspace launches, and manage BrowserWindow lifecycle.
- `WindowManager` (`apps/desktop-shell/src/windowing/window-manager.ts`) wraps creation/focus logic, tracks workspace metadata, and snapshots last-focused timestamps for deterministic restore ordering.
- Devtools open automatically when `NEXUS_ENV=development`.

## Source Layout
- `bootstrap/` hosts the main-process composition root and IPC wiring.
- `preload/` hosts the renderer bridge implementation.
- `windowing/`, `workspace/`, `filesystem/`, `scm/`, `terminal/`, and `system/` isolate responsibilities so Electron-specific behavior does not accumulate in one root folder.

## Window Persistence
- States stored at `<NEXUS_DATA_DIR>/window-state.json` (defaults to `.nexus/window-state.json` unless env overrides).
- Snapshots capture bounds, workspace path, `lastOpenedAt`, and `lastFocusedAt`; up to 8 recent windows are persisted on `before-quit` to avoid stale clutter.
- Startup flow rehydrates stored windows in most-recently-focused order; if none exist, a default window is created. Workspace arguments passed via CLI/OS integration open additional windows on top of the restored set.

## IPC & Preload
- Contracts defined in `packages/contracts/ipc.ts` (`nexus:get-env`, `nexus:log`, `nexus:new-window`, `nexus:get-window-session`, `nexus:open-workspace`).
- Preload exposes the safe API via `window.nexus.getEnv/log/openNewWindow/getWindowSession/openWorkspace` under `contextIsolation` with `nodeIntegration` disabled.
- The current preload remains non-sandboxed at the Electron window level (`sandbox: false`) because the shell loads modular compiled preload files instead of a single bundle; renderer code still runs without Node globals.
- Runtime `@nexus/*` alias resolution searches both compiled package roots (`dist/apps/desktop-shell/packages` and `dist/apps/workbench/packages`) so preload-loaded workbench modules can resolve shared platform/contracts code correctly.
- `WindowManager` resolves the preload entry from the compiled `windowing/` output to `../preload.js` (with a same-directory fallback), keeping BrowserWindow startup aligned with the TypeScript build layout in `dist/apps/desktop-shell/apps/desktop-shell/src/`.
- The preload layer now also mounts the compiled workbench DOM renderer after `DOMContentLoaded`, so Electron windows show the real workbench shell instead of a placeholder HTML card.
- Renderer can request a new empty window or instruct the shell to launch a workspace in a new/reused window; it can also query the current window's session metadata to bootstrap the workbench services.

## Native Menus & Keymaps (IDE-012)
- `KeymapService` (`apps/desktop-shell/src/windowing/keymap-service.ts`) resolves `NEXUS_HOME` (default `.nexus`) and stores user overrides in `<NEXUS_HOME>/keymaps.json`. The service seeds defaults for cross-platform accelerators, watches the JSON file, and emits `changed` events whenever bindings change.
- `MenuService` (`apps/desktop-shell/src/windowing/menu-service.ts`) subscribes to the keymap service, rebuilds the application menu when accelerators change, and wires menu items to either Electron roles or explicit command handlers (new window, open workspace dialog, reload, devtools, zoom, docs).
- Menu install happens once `app` is ready so macOS receives the expected application menu and Services entries; on macOS the first menu item reflects `app.name`.
- Editing `keymaps.json` at runtime triggers a menu rebuild within ~150ms, ensuring shortcuts stay in sync without restarting the IDE. This file lives alongside other `.nexus` persistence artifacts for consistency with env policy.

## File & URL Associations (IDE-013)
- `AssociationService` (`apps/desktop-shell/src/system/association-service.ts`) registers the `nexus://` custom protocol (skipped during tests), handles OS callbacks (`open-url`, `open-file`, second-instance argv), and converts deep links into `WorkspaceLaunchRequest` objects that feed the existing window queue.
- Supported syntax: `nexus://open?workspace=/abs/path` or `nexus://open/abs/path` with an optional `window=new` flag for forcing a new window; links are resolved via the same `resolveWorkspacePath` helper used for CLI paths so `~` expansion and cwd-relative paths behave consistently.
- macOS finder/open-file events drop directly into the queue (forceNew), Windows/Linux links are parsed from `process.argv`, and failures are logged via the shared desktop logger for troubleshooting.

## Crash & Restart Handling (IDE-015)
- `CrashService` (`apps/desktop-shell/src/system/crash-service.ts`) attaches to `uncaughtException`, `unhandledRejection`, and Electron `render-process-gone` events. On a fatal error it records the stack to `<NEXUS_DATA_DIR>/logs/crash.log`, notifies the user via a blocking dialog, and offers Restart, Quit, or Open Crash Log actions.
- Restarting triggers `WindowManager.persistSessions()` before calling `app.relaunch()` so the restored windows match the previous session. Choosing “Open Crash Log” surfaces the log file and allows the user to keep the current process running for diagnostics.
- Crash logging uses the same `.nexus` persistence contract—log folders are created as needed, and repeated crashes while a dialog is open are deduplicated.

## Startup Performance Budget (IDE-016)
- `StartupMetrics` (`apps/desktop-shell/src/system/startup-metrics.ts`) records monotonic performance marks for bootstrap phases (`env-configured`, `app:ready`, `services:initialized`, `windows:restored`, `window-ready`). Once the first window is displayed, a JSON report is written to `<NEXUS_DATA_DIR>/logs/startup.json` and a summary line is logged.
- Default budget is 3s; exceeding it triggers a `status=over budget` log, making it easy to surface regressions in CI or telemetry. Budgets can be tuned per release if needed.
- `WindowManager` emits window-ready callbacks so the first ready-to-show event closes the metrics loop; this ensures instrumentation tracks actual user-visible availability rather than just process readiness.

## Commands
- `yarn nx run desktop-shell:build` – compiles TypeScript entrypoints.
- `yarn nx run desktop-shell:serve` – builds the workbench renderer, builds the desktop shell, then launches Electron.

## Next Steps
- Wire workspace selection UI (IDE-026) to `window.nexus.openWorkspace`, add crash reporting (IDE-015), and expand IPC contracts for explorer/editor features.

## Auto-update Scaffolding (IDE-014)
- `UpdateService` (`apps/desktop-shell/src/system/update-service.ts`) wraps Electron's `autoUpdater`, configures the feed URL from `NEXUS_UPDATE_URL` (or defaults to `https://updates.nexus.dev/<channel>`), and attaches rich logging for each lifecycle event (checking, available, not-available, download progress, downloaded, errors).
- `NEXUS_UPDATE_CHANNEL` (`stable|beta|dev`) and `NEXUS_AUTO_UPDATE` (boolean) are parsed in `packages/platform/config/env.ts`. Auto-update defaults to production builds, remaining off for development/test unless explicitly enabled.
- IPC contracts expose `nexus:check-for-updates` and `nexus:install-update` so the renderer or command palette can trigger a manual check or install step. When initialized, production boots automatically trigger a background check after startup.
- Installers must still provide signed artifacts per platform; this scaffolding simply wires the main process so release engineering can plug real feeds and trigger staged channels later in Phase 8.
