# Build Pipeline (IDE-005)

## Overview
Nx orchestrates builds for `apps/workbench` (workbench runtime + DOM renderer) and `apps/desktop-shell` (Electron main + preload). Each project currently uses TypeScript compilation via `tsc` with sourcemaps and inline sources enabled. The helper script `tools/scripts/run-with-env.mjs` loads `.env` before executing a command, ensuring consistent environment injection across build/watch tasks.

## Targets
### Workbench
- `nx run workbench:build`
  - Executes `tsc -p apps/workbench/tsconfig.app.json`.
  - Outputs to `dist/apps/workbench` with sourcemaps.
  - Produces the compiled DOM renderer consumed by the Electron preload at `dist/apps/workbench/apps/workbench/src/shell/workbench-dom-renderer.js`.
  - `production` configuration auto-sets `NEXUS_ENV=production`.
- `nx run workbench:watch`
  - Uses `tsc --watch` for incremental compilation during development.

### Desktop Shell
- `nx run desktop-shell:build`
  - Executes `tsc -p apps/desktop-shell/tsconfig.app.json`.
  - Outputs to `dist/apps/desktop-shell` with sourcemaps.
  - `tools/scripts/sync-desktop-shell-entry.mjs` mirrors the compiled wrapper entry to `dist/apps/desktop-shell/main.js` so IDE launch configs and Nx serve share the same startup path.
  - Preload resolves and mounts the compiled workbench DOM renderer at runtime.
- `nx run desktop-shell:watch`
  - Watch mode equivalent.
- `nx run desktop-shell:serve`
  - Builds `workbench`, runs a fresh `desktop-shell` build (`--skip-nx-cache`), then launches Electron via `dist/apps/desktop-shell/main.js`.
  - Electron launch also runs through `tools/scripts/run-with-env.mjs` so `.env` values (`NEXUS_HOME`, `NEXUS_ENV`, etc.) apply consistently at runtime.

## Environment Management
- `.env.example` documents default keys (`NEXUS_ENV`, `LOG_LEVEL`).
- `tools/scripts/run-with-env.mjs` loads `.env` (if present) before running the desired command, injecting consistent env vars for both build and watch tasks.
- Distributed caching is enabled via Nx tasks runner configuration in `nx.json`. Local results are stored under `.nx/cache` and mirrored to `.nexus/cache` (or `NEXUS_REMOTE_CACHE_DIR`) through `tools/cache/nexus-remote.js`, allowing teams to point the cache at a shared drive or artifact store.
- CI pipelines should call `tools/scripts/affected-guard.mjs`, which resolves the base/head range (`NX_BASE`/`NX_HEAD` or defaults to `origin/main` → `HEAD`) and runs `nx print-affected` plus `nx affected --target=lint --target=test`. The script exits non-zero if affected targets fail, preventing unrelated projects from running unnecessarily.

## Verification Commands
```
yarn nx run workbench:build
yarn nx run desktop-shell:build
yarn nx run desktop-shell:serve
```
The build commands should generate TypeScript outputs in `dist/`, and `desktop-shell:serve` should open an Electron window with the mounted workbench shell.

## Next Steps
- Replace the current preload-mounted DOM renderer with the final browser-native Angular renderer bundle while keeping the Electron startup contract stable.
- Extend build targets to call the Angular builder and electron-builder once available; maintain env injection via `run-with-env.mjs`.
- Wire `tools/scripts/affected-guard.mjs` into CI once remote cache credentials are provisioned so PRs automatically fetch remote artifacts before executing affected commands.
