# ADR-04 Persistent Storage & Env Contract

## Status
Accepted — March 13, 2026

## Context
- Nexus previously relied on ad-hoc `.nexus` paths relative to the current working directory, which broke in packaged builds and multi-user environments.
- Enterprise customers need to relocate user data, logs, and workspace metadata onto policy-controlled volumes without patching the app.
- Offline/local-first requirements demand that we know exactly where llama.cpp models, telemetry buffers, and backups live.
- Upcoming i18n infrastructure (IDE-181/IDE-182) needs a canonical locale bootstrapper to avoid racing the renderer.

## Decision
1. **Canonical env variables**: Adopt `NEXUS_HOME`, `NEXUS_DATA_DIR`, `NEXUS_WORKSPACE_DATA`, and `NEXUS_LOCALE` as first-class inputs, defaulting to absolute paths under `<homedir>/.nexus` and locale `en-US`. Continue validating `NEXUS_ENV`, `LOG_LEVEL`, `NEXUS_UPDATE_CHANNEL`, and `NEXUS_AUTO_UPDATE`.
2. **Normalization & validation**: `readEnv()` now resolves relative/`~/` paths to absolutes, validates enums/locales, and exposes the resolved directory trio to every process.
3. **Storage layout helper**: Introduce `packages/platform/workspace/storage-layout.ts` to (a) create directories, (b) migrate legacy locations using `~/.nexus-meta.json`, and (c) append JSON migration logs to `<NEXUS_HOME>/meta/storage-migrations.log`.
4. **Documentation & governance**: Document the schema in `docs/architecture/environment.md` and treat IDE-180 as a prerequisite for any epic that persists data or depends on locale bootstrapping.

## Consequences
- ✅ Deterministic paths make onboarding, backups, and support playbooks much easier.
- ✅ Enterprises can redirect Nexus data by setting env vars; migrations happen automatically with auditable logs.
- ✅ i18n and telemetry pipelines can trust a single source of truth for locale and persistence.
- ⚠️ Startup now fails fast when env vars are malformed—this is intentional but requires better UX messaging (tracked under IDE-025/IDE-170).
- 📌 Follow-up: surface migration telemetry once the consent center (IDE-170) is available so ops teams can monitor policy rollouts.
