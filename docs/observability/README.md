# Observability Platform

`IDE-117` and `IDE-119` establish the first canonical observability platform for Nexus.

## Scope

The platform now provides:

- a typed IPC contract for telemetry capture, replay, and health inspection
- local structured buffering under `NEXUS_DATA_DIR/telemetry/events.jsonl`
- a pluggable crash-reporting pipeline with local file persistence and an optional enterprise endpoint
- a feature-flag framework with local file, env, CLI, and optional remote manifest sources
- redaction of sensitive attribute keys such as `token`, `secret`, `password`, `authorization`, `cookie`, and `key`
- anonymized crash report messages and stacks before they are persisted or uploaded
- replay APIs for local diagnostics and future health dashboards
- integration with desktop startup metrics, crash capture, and renderer log ingestion

The canonical shared buffer implementation lives in [packages/platform/observability/telemetry-store.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/packages/platform/observability/telemetry-store.ts). The desktop-shell integration layer lives in [apps/desktop-shell/src/system/telemetry-service.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/apps/desktop-shell/src/system/telemetry-service.ts).
Crash report shaping and path anonymization live in [packages/platform/observability/crash-report.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/packages/platform/observability/crash-report.ts). Desktop crash sinks live in [apps/desktop-shell/src/system/crash-reporting.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/apps/desktop-shell/src/system/crash-reporting.ts).
Feature-flag evaluation lives in [packages/platform/observability/feature-flags.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/packages/platform/observability/feature-flags.ts), and the desktop integration layer lives in [apps/desktop-shell/src/system/feature-flag-service.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/apps/desktop-shell/src/system/feature-flag-service.ts).

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
- Format: newline-delimited JSON records plus a trailing metadata line for dropped-count and last-sequence state
- Retention:
  - maximum 1000 events by default
  - maximum buffer size 2 MB by default
  - oldest records are pruned first when limits are exceeded

This platform is intentionally local-first. Consent/export workflows are deferred to `IDE-170`.

## Desktop Integration

The desktop shell records:

- `desktop.app.ready` when Electron reaches the ready lifecycle
- `desktop.startup.completed` when the first window is ready, including timing measurements
- `desktop.crash.captured` when the crash handler persists a fatal failure
- `desktop.crash.report.sent` and `desktop.crash.report.failed` for enterprise crash upload outcomes
- `renderer.log` when the renderer sends normalized log messages through the preload bridge
- `desktop.feature-flags.loaded` and `desktop.feature-flags.refreshed` when the flag snapshot changes

The preload bridge also exposes direct telemetry APIs so future renderer features can emit structured telemetry without abusing the log channel.

Crash capture is local-first:

- Local sink: `<NEXUS_DATA_DIR>/logs/crash.log`
- Remote sink: enabled only when `NEXUS_CRASH_REPORTING_URL` is configured
- Upload behavior: never automatic; the crash dialog shows an explicit `Send Report and Restart Nexus` action only when the remote sink is available
- Privacy: absolute user/workspace paths are replaced with placeholders such as `<user-home>`, `<cwd>`, and `<workspace-data-dir>`

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
- `IDE-170` should layer consent, export, and privacy controls over the local buffer.
- `IDE-120` can use the replay and health APIs as the backend for an in-product diagnostics surface.
