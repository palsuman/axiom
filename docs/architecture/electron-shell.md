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
- Contracts defined in `packages/contracts/ipc.ts` (`nexus:get-env`, `nexus:log`, `nexus:new-window`, `nexus:get-window-session`, `nexus:open-workspace`, telemetry APIs, privacy APIs, feature-flag APIs, and AI controller APIs).
- Preload exposes the safe API via `window.nexus.getEnv/log/openNewWindow/getWindowSession/openWorkspace/telemetry*/privacy*/featureFlagsList/aiController*` under `contextIsolation` with `nodeIntegration` disabled.
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
- `CrashService` (`apps/desktop-shell/src/system/crash-service.ts`) attaches to `uncaughtException`, `unhandledRejection`, and Electron `render-process-gone` events. On a fatal error it delegates to `CrashReporter` (`apps/desktop-shell/src/system/crash-reporting.ts`), which builds an anonymized crash report, persists it to `<NEXUS_DATA_DIR>/logs/crash.log`, and optionally uploads it to an enterprise endpoint when the user explicitly opts in.
- Restarting triggers `WindowManager.persistSessions()` before calling `app.relaunch()` so the restored windows match the previous session. Choosing “Open Crash Log” surfaces the log file and allows the user to keep the current process running for diagnostics.
- When `NEXUS_CRASH_REPORTING_URL` is configured, the dialog exposes a `Send Report and Restart Nexus` action. Uploads are not automatic; every crash still requires user confirmation before a report leaves the machine.
- Crash logging uses the same `.nexus` persistence contract, redacts absolute user/workspace paths before writing, and deduplicates repeated crashes while a dialog is open.

## Telemetry Platform (IDE-117)
- `TelemetryService` (`apps/desktop-shell/src/system/telemetry-service.ts`) wraps the shared `TelemetryStore` (`packages/platform/observability/telemetry-store.ts`) and persists structured events to `<NEXUS_DATA_DIR>/telemetry/events.jsonl`.
- IPC contracts now expose `nexus:telemetry:track`, `nexus:telemetry:replay`, and `nexus:telemetry:health`, allowing preload and renderer callers to record structured events and retrieve local replay/health summaries without direct filesystem access.
- Renderer logs sent through `nexus:log` are mirrored into telemetry as `renderer.log` events, while startup completion and fatal crashes emit `desktop.startup.completed` and `desktop.crash.captured`.
- Telemetry attributes with sensitive key names are redacted before persistence, and collection now consults the effective privacy consent snapshot before writing to disk.

## Privacy Center (IDE-170)
- `PrivacyService` (`apps/desktop-shell/src/system/privacy-service.ts`) persists user consent under `<NEXUS_DATA_DIR>/privacy/user-consent.json`, workspace overrides under `<NEXUS_WORKSPACE_DATA>/privacy-consent/<workspace-id>.json`, and export bundles under `<NEXUS_DATA_DIR>/privacy/exports/`.
- IPC contracts now expose `nexus:privacy:get-consent`, `nexus:privacy:update-consent`, `nexus:privacy:export-data`, and `nexus:privacy:delete-data`.
- Consent is modeled per category (`usageTelemetry`, `crashReports`) with both user-scope and workspace-scope timestamps.
- Remote crash upload now requires both the feature-flag kill switch to be enabled and the effective `crashReports` consent category to be enabled.

## Feature Flags (IDE-121)
- `FeatureFlagService` (`apps/desktop-shell/src/system/feature-flag-service.ts`) evaluates a typed flag registry from a local manifest, env overrides, CLI overrides, and an optional remote manifest refresh.
- The shell now exposes `nexus:feature-flags:list` through preload so renderer/runtime consumers can inspect the current read-only flag snapshot without direct filesystem access.
- Built-in flags currently cover observability rollout control: `observability.remoteCrashReporting`, `observability.performanceTracing`, and `observability.healthDiagnostics`.
- Telemetry events automatically carry the current flag snapshot summary and `ff:<key>` tags for active flags, so staged rollout state is visible in replay and diagnostics.
- Remote crash reporting now respects the `observability.remoteCrashReporting` kill switch even when the crash endpoint is configured in env.

## AI Controller (IDE-085)
- `LlamaControllerService` (`apps/desktop-shell/src/ai/llama-controller-service.ts`) is the desktop-facing facade over the shared `packages/ai-core/controller/llama-controller.ts` runtime.
- The service manages the local `llama-server` subprocess lifecycle, auto-discovers binaries under `<NEXUS_DATA_DIR>/ai/llama.cpp` (plus the legacy `<NEXUS_HOME>/llama.cpp` layout), resolves relative model paths under `<NEXUS_DATA_DIR>/ai/models`, and exposes typed IPC endpoints for health, start, stop, and benchmark operations.
- Health probes use the managed loopback HTTP endpoint (`/health`) with a configurable timeout, and unexpected process exits trigger bounded automatic restart attempts when `restartOnCrash` is enabled.
- Benchmarking is intentionally health-focused at this stage: the benchmark harness measures repeated health-probe latency and failure rate so later AI tasks can compare runtime stability before token streaming is added.

## Startup Performance Budget (IDE-016)
- `StartupMetrics` (`apps/desktop-shell/src/system/startup-metrics.ts`) records monotonic performance marks for bootstrap phases (`env-configured`, `app:ready`, `services:initialized`, `windows:restored`, `window-ready`). Once the first window is displayed, a JSON report is written to `<NEXUS_DATA_DIR>/logs/startup.json` and a summary line is logged.
- Default budget is 3s; exceeding it triggers a `status=over budget` log, making it easy to surface regressions in CI or telemetry. Budgets can be tuned per release if needed.
- `WindowManager` emits window-ready callbacks so the first ready-to-show event closes the metrics loop; this ensures instrumentation tracks actual user-visible availability rather than just process readiness.

## Commands
- `yarn nx run desktop-shell:build` – compiles TypeScript entrypoints.
- `yarn nx run desktop-shell:serve` – builds the workbench renderer, builds the desktop shell, then launches Electron.

## Next Steps
- Expand diagnostics surfaces on top of telemetry and crash replay (`IDE-120`).

## Auto-update Scaffolding (IDE-014)
- `UpdateService` (`apps/desktop-shell/src/system/update-service.ts`) wraps Electron's `autoUpdater`, configures the feed URL from `NEXUS_UPDATE_URL` (or defaults to `https://updates.nexus.dev/<channel>`), and attaches rich logging for each lifecycle event (checking, available, not-available, download progress, downloaded, errors).
- `NEXUS_UPDATE_CHANNEL` (`stable|beta|dev`) and `NEXUS_AUTO_UPDATE` (boolean) are parsed in `packages/platform/config/env.ts`. Auto-update defaults to production builds, remaining off for development/test unless explicitly enabled.
- Crash-reporting config also lives in `packages/platform/config/env.ts`: `NEXUS_CRASH_REPORTING_URL`, `NEXUS_CRASH_REPORTING_ENABLED`, and `NEXUS_CRASH_REPORTING_TIMEOUT_MS`.
- Feature-flag config also lives in `packages/platform/config/env.ts`: `NEXUS_FEATURE_FLAGS_FILE`, `NEXUS_FEATURE_FLAGS_URL`, and `NEXUS_FEATURE_FLAGS`.
- IPC contracts expose `nexus:check-for-updates` and `nexus:install-update` so the renderer or command palette can trigger a manual check or install step. When initialized, production boots automatically trigger a background check after startup.
- Installers must still provide signed artifacts per platform; this scaffolding simply wires the main process so release engineering can plug real feeds and trigger staged channels later in Phase 8.
