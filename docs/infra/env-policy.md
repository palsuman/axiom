# Env & Secrets Policy (IDE-008)

## Variables
| Key | Description | Default | Scope |
| --- | --- | --- | --- |
| `NEXUS_ENV` | Runtime mode (development/production/test). | `development` | App + build scripts |
| `LOG_LEVEL` | Log verbosity (`error`, `warn`, `info`, `debug`). | `info` | App |
| `NEXUS_HOME` | Root directory for `.nexus` data (workspaces, caches, AI models). | `.nexus` | Electron main + services |
| `NEXUS_DATA_DIR` | Override for data storage (falls back to `NEXUS_HOME`). | (unset) | Electron main + services |
| `NEXUS_REGISTRY_URL` | Optional custom npm registry. | (unset) | Yarn install scripts |

## Handling Secrets
- Never commit `.env` files containing secrets; only `.env.example` is tracked.
- Use OS credential store (Keychain/Windows Credential Manager) for tokens.
- Future integration with Vault/1Password will plug in via `packages/platform/secrets` (stub for now).

## Runtime Loading
- `tools/scripts/run-with-env.mjs` automatically loads `.env` (using `dotenv`) for Nx commands.
- Electron/Node processes should import a central `env.ts` helper (to be implemented) that reads env vars, provides defaults, and validates required values.

## Validation Strategy
1. Build `packages/platform/env.ts` exporting `readEnv()` that throws if required variables missing or invalid.
2. Unit test env parsing once the helper exists.
3. During packaging, ensure `.env` is optional; production builds rely on OS env injection or config files.

## Telemetry
- Avoid logging env values directly. Mask secrets (API keys) once they are introduced.
- Add log redaction middleware (placeholder for IDE-125).
