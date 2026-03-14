# Build Pipeline (IDE-005)

## Overview
Nx orchestrates builds for `apps/workbench` (Angular renderer placeholder) and `apps/desktop-shell` (Electron main placeholder). Each project uses TypeScript compilation via `tsc` with sourcemaps and inline sources enabled. The helper script `tools/scripts/run-with-env.mjs` loads `.env` before executing a command, ensuring consistent environment injection across build/watch tasks.

## Targets
### Workbench
- `nx run workbench:build`
  - Executes `tsc -p apps/workbench/tsconfig.app.json`.
  - Outputs to `dist/apps/workbench` with sourcemaps.
  - `production` configuration auto-sets `NEXUS_ENV=production`.
- `nx run workbench:watch`
  - Uses `tsc --watch` for incremental compilation during development.

### Desktop Shell
- `nx run desktop-shell:build`
  - Executes `tsc -p apps/desktop-shell/tsconfig.app.json`.
  - Outputs to `dist/apps/desktop-shell` with sourcemaps.
- `nx run desktop-shell:watch`
  - Watch mode equivalent.

## Environment Management
- `.env.example` documents default keys (`NEXUS_ENV`, `LOG_LEVEL`).
- `tools/scripts/run-with-env.mjs` loads `.env` (if present) before running the desired command, injecting consistent env vars for both build and watch tasks.
- Distributed caching is enabled via Nx tasks runner configuration in `nx.json`. Local results are stored under `.nx/cache` and mirrored to `.nexus/cache` (or `NEXUS_REMOTE_CACHE_DIR`) through `tools/cache/nexus-remote.js`, allowing teams to point the cache at a shared drive or artifact store.
- CI pipelines should call `tools/scripts/affected-guard.mjs`, which resolves the base/head range (`NX_BASE`/`NX_HEAD` or defaults to `origin/main` → `HEAD`) and runs `nx print-affected` plus `nx affected --target=lint --target=test`. The script exits non-zero if affected targets fail, preventing unrelated projects from running unnecessarily.

## Verification Commands
```
yarn nx run workbench:build
yarn nx run desktop-shell:build
```
Both commands should emit placeholder bootstrap logs referencing the active `NEXUS_ENV` and generate TypeScript outputs in `dist/`.

## Next Steps
- Swap placeholder `main.ts` entries with real Angular/Electron bootstraps when frameworks are introduced.
- Extend build targets to call Angular builder and electron-builder once available; maintain env injection via `run-with-env.mjs`.
- Wire `tools/scripts/affected-guard.mjs` into CI once remote cache credentials are provisioned so PRs automatically fetch remote artifacts before executing affected commands.
