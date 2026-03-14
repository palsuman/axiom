# Env & Secrets Policy (IDE-008)

## Variables
| Key | Description | Default | Scope |
| --- | --- | --- | --- |
| `NEXUS_ENV` | Runtime mode (development/production/test). | `development` | App + build scripts |
| `LOG_LEVEL` | Log verbosity (`error`, `warn`, `info`, `debug`). | `info` | App |
| `NEXUS_HOME` | Root directory for `.nexus` data (workspaces, caches, AI models). | `.nexus` | Electron main + services |
| `NEXUS_DATA_DIR` | Override for data storage (falls back to `NEXUS_HOME`). | (unset) | Electron main + services |
| `NEXUS_CRASH_REPORTING_URL` | Optional enterprise endpoint for anonymized crash uploads. | (unset) | Electron main |
| `NEXUS_CRASH_REPORTING_ENABLED` | Enables the remote crash sink when an endpoint exists. | Auto (`true` if URL is set) | Electron main |
| `NEXUS_CRASH_REPORTING_TIMEOUT_MS` | Timeout for crash report uploads. | `5000` | Electron main |
| `NEXUS_FEATURE_FLAGS_FILE` | Local feature-flag manifest path. | `<NEXUS_DATA_DIR>/config/feature-flags.json` | Electron main |
| `NEXUS_FEATURE_FLAGS_URL` | Optional remote feature-flag manifest URL. | (unset) | Electron main |
| `NEXUS_FEATURE_FLAGS` | Inline env overrides for feature flags. | (unset) | Electron main |
| `NEXUS_REGISTRY_URL` | Optional custom npm registry. | (unset) | Yarn install scripts |

## Handling Secrets
- Never commit `.env` files containing secrets; only `.env.example` is tracked.
- Use OS credential store (Keychain/Windows Credential Manager) for tokens.
- Future integration with Vault/1Password will plug in via `packages/platform/secrets` (stub for now).

## Runtime Loading
- `tools/scripts/run-with-env.mjs` automatically loads `.env` (using `dotenv`) for Nx commands.
- Electron/Node processes import `packages/platform/config/env.ts`, which reads env vars, provides defaults, normalizes paths/URLs, and validates invalid inputs at startup.

## Validation Strategy
1. `packages/platform/config/env.ts` exports `readEnv()` and throws if variables are invalid.
2. Unit tests cover env parsing, path normalization, URL validation, and feature-flag/crash-reporting contracts.
3. During packaging, ensure `.env` is optional; production builds rely on OS env injection or config files.

## Telemetry
- Avoid logging env values directly. Mask secrets (API keys) once they are introduced.
- Add log redaction middleware (placeholder for IDE-125).
- Crash reports must be anonymized before local persistence or remote upload. User and workspace absolute paths are not allowed to leave the process boundary in raw form.
- Feature-flag overrides are operational controls, not secrets, but they still must be validated and logged in normalized form only.
