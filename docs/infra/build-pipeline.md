# Build Pipeline (IDE-005)

## Overview
Nx orchestrates builds for `apps/workbench` (primary Angular renderer plus supporting TypeScript service/domain compilation) and `apps/desktop-shell` (Electron main + preload). The historical preload-mounted DOM renderer has been removed from the Electron runtime path. The helper script `tools/scripts/run-with-env.mjs` loads `.env` before executing a command, ensuring consistent environment injection across build/watch tasks.

Current renderer/build-state alignment:
- `apps/workbench/angular` is the current primary renderer path.
- Angular 21 dependencies, `angular.json`, and workbench Angular build/lint/test/serve targets are installed and required for Electron startup.
- The `tsc` pipeline remains for historical TypeScript workbench modules and test coverage, but not as an Electron renderer host.
- `package.json`, `angular.json`, `apps/workbench/project.json`, `tasks/TASKS.md`, and `docs/architecture/renderer-migration.md` must all describe the same migration stage.

## Targets
### Workbench
- `nx run workbench:build`
  - Executes `tsc -p apps/workbench/tsconfig.app.json`.
  - Outputs to `dist/apps/workbench` with sourcemaps.
  - Produces compiled TypeScript workbench modules used for historical service/domain coverage and migration verification.
  - `production` configuration auto-sets `NEXUS_ENV=production`.
- `nx run workbench:build-angular`
  - Executes `ng build workbench-angular` through the Angular CLI workspace defined in `angular.json`.
  - Outputs the Angular browser bundle to `dist/apps/workbench/angular`.
  - Produces the canonical Angular renderer bootstrap used by Electron and migration verification.
- `nx run workbench:test-angular`
  - Executes `jest --config apps/workbench/jest.angular.config.cjs --runInBand`.
  - Verifies Angular bootstrap helpers, bridge resolution, and shell bootstrap services using `jest-preset-angular`.
- `nx run workbench:lint-angular`
  - Lints the Angular bootstrap source under `apps/workbench/angular/src`.
- `nx run workbench:serve-angular`
  - Executes `ng serve workbench-angular` through the Angular CLI for standalone renderer bootstrap development.
- `nx run workbench:watch`
  - Uses `tsc --watch` for incremental compilation during development.

### Desktop Shell
- `nx run desktop-shell:build`
  - Executes `tsc -p apps/desktop-shell/tsconfig.app.json`.
  - Outputs to `dist/apps/desktop-shell` with sourcemaps.
  - `tools/scripts/sync-desktop-shell-entry.mjs` mirrors the compiled wrapper entry to `dist/apps/desktop-shell/main.js` so IDE launch configs and Nx serve share the same startup path.
  - Preload resolves and mounts the Angular renderer only.
- `nx run desktop-shell:watch`
  - Watch mode equivalent.
- `nx run desktop-shell:serve`
  - Builds `workbench:build-angular`, runs a fresh `desktop-shell` build (`--skip-nx-cache`), then launches Electron via `dist/apps/desktop-shell/main.js`.
  - Electron launch also runs through `tools/scripts/run-with-env.mjs` so `.env` values (`NEXUS_HOME`, `NEXUS_ENV`, etc.) apply consistently at runtime.
  - No legacy DOM renderer path remains in the default runtime.

## Environment Management
- `.env.example` documents default keys (`NEXUS_ENV`, `LOG_LEVEL`).
- `tools/scripts/run-with-env.mjs` loads `.env` (if present) before running the desired command, injecting consistent env vars for both build and watch tasks.
- Distributed caching is enabled via Nx tasks runner configuration in `nx.json`. Local results are stored under `.nx/cache` and mirrored to `.nexus/cache` (or `NEXUS_REMOTE_CACHE_DIR`) through `tools/cache/nexus-remote.js`, allowing teams to point the cache at a shared drive or artifact store.
- CI pipelines should call `tools/scripts/affected-guard.mjs`, which resolves the base/head range (`NX_BASE`/`NX_HEAD` or defaults to `origin/main` → `HEAD`) and runs `nx print-affected` plus `nx affected --target=lint --target=test`. The script exits non-zero if affected targets fail, preventing unrelated projects from running unnecessarily.

## Verification Commands
```
yarn nx run workbench:build
yarn nx run workbench:build-angular
yarn nx run workbench:test-angular
yarn nx run desktop-shell:build
yarn nx run desktop-shell:serve
```
`desktop-shell:serve` opens Electron on the Angular path only. The Angular build commands generate the canonical renderer bundle in `dist/`.

## Next Steps
- Wire `tools/scripts/affected-guard.mjs` into CI once remote cache credentials are provisioned so PRs automatically fetch remote artifacts before executing affected commands.
