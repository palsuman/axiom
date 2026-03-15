# Observability Platform

`IDE-117`, `IDE-119`, `IDE-121`, and `IDE-170` establish the canonical observability and privacy platform for Nexus.

## Scope

The platform now provides:

- a typed IPC contract for telemetry capture, replay, and health inspection
- local structured buffering under `NEXUS_DATA_DIR/telemetry/events.jsonl`
- a pluggable crash-reporting pipeline with local file persistence and an optional enterprise endpoint
- a feature-flag framework with local file, env, CLI, and optional remote manifest sources
- a privacy consent store with per-user and per-workspace overrides
- export and delete workflows for buffered telemetry data
- redaction of sensitive attribute keys such as `token`, `secret`, `password`, `authorization`, `cookie`, and `key`
- anonymized crash report messages and stacks before they are persisted or uploaded
- replay APIs for local diagnostics and future health dashboards
- integration with desktop startup metrics, crash capture, and renderer log ingestion

The canonical shared buffer implementation lives in [packages/platform/observability/telemetry-store.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/packages/platform/observability/telemetry-store.ts). The desktop-shell integration layer lives in [apps/desktop-shell/src/system/telemetry-service.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/apps/desktop-shell/src/system/telemetry-service.ts).
Crash report shaping and path anonymization live in [packages/platform/observability/crash-report.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/packages/platform/observability/crash-report.ts). Desktop crash sinks live in [apps/desktop-shell/src/system/crash-reporting.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/apps/desktop-shell/src/system/crash-reporting.ts).
Feature-flag evaluation lives in [packages/platform/observability/feature-flags.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/packages/platform/observability/feature-flags.ts), and the desktop integration layer lives in [apps/desktop-shell/src/system/feature-flag-service.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/apps/desktop-shell/src/system/feature-flag-service.ts).
Consent persistence lives in [packages/platform/observability/privacy-consent-store.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/packages/platform/observability/privacy-consent-store.ts), while the desktop privacy workflow layer lives in [apps/desktop-shell/src/system/privacy-service.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/apps/desktop-shell/src/system/privacy-service.ts). The renderer-facing editor service lives in [apps/workbench/src/observability/privacy-center-service.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/apps/workbench/src/observability/privacy-center-service.ts).

## Event Model

Telemetry events use the shared contract in [packages/contracts/ipc.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/packages/contracts/ipc.ts).

Each event includes:

- `name`: stable event identifier such as `desktop.app.ready`
- `scope`: `main`, `renderer`, `preload`, or `shared`
- `level`: `error`, `warn`, `info`, or `debug`
- optional `message`
- optional structured `attributes`
- optional numeric `measurements`
- optional `tags`
- optional `sessionId` and `workspaceId`

Recorded events are normalized into monotonic `sequence` order and persisted with `recordedAt` timestamps.

## Storage Contract

- Buffer file: `<NEXUS_DATA_DIR>/telemetry/events.jsonl`
- User consent file: `<NEXUS_DATA_DIR>/privacy/user-consent.json`
- Workspace consent files: `<NEXUS_WORKSPACE_DATA>/privacy-consent/<workspace-id>.json`
- Telemetry export files: `<NEXUS_DATA_DIR>/privacy/exports/telemetry-export-<timestamp>.json`
- Format: newline-delimited JSON records plus a trailing metadata line for dropped-count and last-sequence state
- Retention:
  - maximum 1000 events by default
  - maximum buffer size 2 MB by default
  - oldest records are pruned first when limits are exceeded

Consent defaults are:

- `usageTelemetry = true`
- `crashReports = false`

User consent provides the baseline. Workspace consent overrides that baseline for telemetry collection and crash-report sharing when a workspace is active. Each persisted consent record stores its own `updatedAt` timestamp so audits can distinguish user-wide review from workspace-specific review.

## Desktop Integration

The desktop shell records:

- `desktop.app.ready` when Electron reaches the ready lifecycle
- `desktop.startup.completed` when the first window is ready, including timing measurements
- `desktop.crash.captured` when the crash handler persists a fatal failure
- `desktop.crash.report.sent` and `desktop.crash.report.failed` for enterprise crash upload outcomes
- `renderer.log` when the renderer sends normalized log messages through the preload bridge
- `desktop.feature-flags.loaded` and `desktop.feature-flags.refreshed` when the flag snapshot changes

The preload bridge also exposes direct telemetry APIs so future renderer features can emit structured telemetry without abusing the log channel.
It also exposes privacy APIs so the renderer can load consent state, save user/workspace overrides, export buffered telemetry, and delete buffered telemetry without direct filesystem access.

Crash capture is local-first:

- Local sink: `<NEXUS_DATA_DIR>/logs/crash.log`
- Remote sink: enabled only when `NEXUS_CRASH_REPORTING_URL` is configured
- Upload behavior: never automatic; the crash dialog shows an explicit `Send Report and Restart Nexus` action only when the remote sink is available
- Privacy: absolute user/workspace paths are replaced with placeholders such as `<user-home>`, `<cwd>`, and `<workspace-data-dir>`
- Remote availability: crash upload also requires `crashReports` consent to be enabled in the effective privacy snapshot

## Privacy Center

The workbench now exposes a dedicated `privacy://center` editor resource through the `nexus.privacy.center.open` command.

The surface includes:

- user-scope consent toggles
- workspace-scope consent toggles
- effective consent resolution
- telemetry buffer health
- export requests for all data or the active workspace subset
- delete requests that clear the buffered telemetry store and optionally remove generated export files

### Privacy IPC Channels

- `nexus:privacy:get-consent`
  - Returns the full consent snapshot, category definitions, and telemetry buffer health for the current workspace context
- `nexus:privacy:update-consent`
  - Accepts `{ scope, workspaceId?, preferences }`
  - Persists consent with a fresh timestamp and returns the updated snapshot
- `nexus:privacy:export-data`
  - Accepts `{ workspaceId?, mode? }`
  - Writes a structured JSON export bundle and returns `{ path, recordCount, exportedAt, mode }`
- `nexus:privacy:delete-data`
  - Accepts `{ deleteExports? }`
  - Clears the buffered telemetry store and optionally removes generated export files

## Feature Flags

Feature flags are evaluated from these sources, in precedence order:

- local manifest file: `NEXUS_FEATURE_FLAGS_FILE` or the default `<NEXUS_DATA_DIR>/config/feature-flags.json`
- optional remote manifest refresh: `NEXUS_FEATURE_FLAGS_URL`
- env overrides: `NEXUS_FEATURE_FLAGS`
- CLI overrides: `--feature-flag`, `--disable-feature-flag`, `--feature-flags=/path/to/file.json`, `--feature-flags-url=https://...`

Manifest format:

```json
{
  "version": 1,
  "flags": {
    "observability.remoteCrashReporting": { "enabled": true },
    "observability.healthDiagnostics": { "rolloutPercentage": 25 },
    "observability.performanceTracing": { "killSwitch": true }
  }
}
```

The current desktop integration registers:

- `observability.remoteCrashReporting`
- `observability.performanceTracing`
- `observability.healthDiagnostics`

Telemetry events automatically include the current flag snapshot summary in the `featureFlags` attribute, and active flags are mirrored into tags with the `ff:` prefix.

## Verification

- `./node_modules/.bin/jest --config packages/contracts/jest.config.cjs --runInBand`
- `./node_modules/.bin/jest --config packages/platform/jest.config.cjs --runInBand`
- `./node_modules/.bin/jest --config apps/desktop-shell/jest.config.cjs --runInBand`
- `./node_modules/.bin/jest --config apps/workbench/jest.config.cjs --runInBand`
- `./node_modules/.bin/eslint packages/contracts packages/platform apps/desktop-shell/src apps/workbench/src --ext .ts`

## Follow-on Work

- `IDE-118` should build performance tracing on top of these typed telemetry events.
- `IDE-120` can use the replay and health APIs as the backend for an in-product diagnostics surface.
