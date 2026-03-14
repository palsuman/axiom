# Environment & Persistence Contract

Nexus relies on a strict set of environment variables so every service, extension host, and UI feature can locate user/workspace state deterministically across platforms. The defaults intentionally keep everything under a `.nexus` directory in each OS user profile to simplify backups and enterprise policy enforcement.

## Canonical variables

| Variable | Default | Purpose | Notes |
| --- | --- | --- | --- |
| `NEXUS_ENV` | `development` | Controls runtime mode. | `development`, `production`, `test` only. |
| `LOG_LEVEL` | `info` | Global log verbosity. | `error`, `warn`, `info`, `debug`. |
| `NEXUS_HOME` | `<home>/.nexus` | Root for user-level state (settings, AI assets, metadata). | Accepts absolute paths or values relative to `~`. |
| `NEXUS_DATA_DIR` | `NEXUS_HOME` | Writable area for logs, window state, caches. | Override when redirecting data to managed volumes. |
| `NEXUS_WORKSPACE_DATA` | `<NEXUS_DATA_DIR>/workspaces` | Workspace history, trust flags, session backups. | Override for per-user ephemeral storage. |
| `NEXUS_LOCALE` | `en-US` | Default locale for renderer bootstrapping and i18n fallback. | Validated against BCP-47 style regex; invalid values block startup. |
| `NEXUS_UPDATE_CHANNEL` | `stable` | Determines which release feed `electron-updater` uses. | `stable`, `beta`, or `dev`. |
| `NEXUS_UPDATE_URL` | _unset_ | Optional explicit feed URL (overrides channel). | Used for air-gapped enterprise mirrors. |
| `NEXUS_AUTO_UPDATE` | `production → true`, otherwise `false` | Toggles background update checks. | Accepts `1/0`, `true/false`, `yes/no`. |
| `NEXUS_CRASH_REPORTING_URL` | _unset_ | Optional enterprise endpoint for anonymized crash-report uploads. | When set, the crash dialog can offer explicit opt-in upload. |
| `NEXUS_CRASH_REPORTING_ENABLED` | `true` if URL is set, else `false` | Enables the remote crash-report sink. | Local crash logging remains on regardless. |
| `NEXUS_CRASH_REPORTING_TIMEOUT_MS` | `5000` | Upload timeout for the remote crash-report sink. | Must be a positive integer. |
| `NEXUS_FEATURE_FLAGS_FILE` | `<NEXUS_DATA_DIR>/config/feature-flags.json` | Local feature-flag manifest path. | Supports staged rollout and kill-switch rules. |
| `NEXUS_FEATURE_FLAGS_URL` | _unset_ | Optional remote feature-flag manifest URL. | Refreshed after app ready. |
| `NEXUS_FEATURE_FLAGS` | _unset_ | Inline env override list for feature flags. | Example: `flag.a=true,flag.b=rollout:25`. |

## Directory layout

```
<NEXUS_HOME>/
  meta/
    storage-migrations.log    # append-only JSON lines
  settings/
  ai/
  logs/
  telemetry/
  workspaces/                 # default value for NEXUS_WORKSPACE_DATA
```

- `NEXUS_DATA_DIR` defaults to `NEXUS_HOME`. Services can create subdirectories (`logs/`, `window-state/`, `telemetry/`) under this root without additional configuration.
- Feature-flag manifests default to `<NEXUS_DATA_DIR>/config/feature-flags.json`, keeping rollout policy with the rest of local observability state.
- Crash reports live under `NEXUS_DATA_DIR/logs/crash.log`; optional enterprise uploads reuse the same anonymized payload instead of building a separate format.
- Renderer persistence is scoped to `NEXUS_WORKSPACE_DATA`; workspace trust, history, and session restore live here to keep them portable for enterprise sync.
- Crash-safe backups live under `<NEXUS_WORKSPACE_DATA>/backups/<workspaceId>/snapshot.json`. Each snapshot includes dirty editors, terminal scrollback, and run/debug metadata while enforcing a hard 500 MB per-workspace cap.
- `~/.nexus` is not assumed to exist; the runtime now guarantees creation through the storage layout helper described below.

## Storage layout & migrations

- `packages/platform/workspace/storage-layout.ts` exposes `ensureStorageLayout(env)` which:
  - Resolves absolute paths for `NEXUS_HOME`, `NEXUS_DATA_DIR`, and `NEXUS_WORKSPACE_DATA`.
  - Creates directories if missing.
  - Reads `~/.nexus-meta.json` to determine the last known locations.
  - Migrates content (rename/copy) when the user or policy changes any of the directories.
  - Appends JSON records to `<NEXUS_HOME>/meta/storage-migrations.log` for auditability and telemetry.
- Metadata schema:

```json
{
  "lastHome": "/Users/alex/.nexus",
  "lastDataDir": "/Users/alex/.nexus",
  "lastWorkspaceDataDir": "/Users/alex/.nexus/workspaces"
}
```

- Migration records include timestamp, target (`home`, `data`, `workspace`), status, and reason (e.g., `destination-not-empty`).
- All migrations run before window state or workspace history is accessed, ensuring downstream services only see valid locations.

## Locale & i18n readiness

- `NEXUS_LOCALE` seeds the renderer i18n service; Angular modules fall back to the locale in settings once the renderer boots.
- Invalid locale strings fail fast at startup so translation packs are never loaded with ambiguous identifiers.
- Future locale sync (IDE-181/IDE-182) should continue to respect this default to keep headless CLI flows deterministic.

## Operational guidance

- **Enterprise overrides**: set `NEXUS_HOME` to a managed mount (e.g., `/var/opt/nexus/<user>`) and allow the migration helper to move existing `.nexus` data.
- **Telemetry/privacy**: logs live under `NEXUS_DATA_DIR/logs` and structured telemetry buffers live under `NEXUS_DATA_DIR/telemetry`; redirecting this directory moves crash dumps, startup traces, and telemetry replay data together.
- **Crash uploads**: `NEXUS_CRASH_REPORTING_URL` only enables an opt-in action in the crash dialog. No crash payload is uploaded automatically, and absolute user/workspace paths are redacted before persistence or upload.
- **Feature flags**: use `NEXUS_FEATURE_FLAGS_FILE` for local policy, `NEXUS_FEATURE_FLAGS` for emergency env overrides, and `--feature-flag` / `--disable-feature-flag` for one-off launch-time changes.
- **Backups**: copy the entire `NEXUS_HOME` directory; migration metadata ensures restores respect policy overrides on next launch.
