# Renderer Migration Alignment

## Purpose
This document is the authoritative repository-alignment contract for the renderer migration.

It exists to keep four things in sync:
- the current implementation state
- the target Angular renderer state
- package/build expectations
- the execution policy that pauses renderer feature work until migration signoff

This document is controlled by `IDE-207`, `IDE-208`, `IDE-209`, and `IDE-210`.

## Current State
- Electron preload now launches the Angular renderer bundle as the default workbench path.
- `apps/workbench/angular` owns the standalone zoneless shell host, Angular command routing host, Angular theme host, and the browser bootstrap.
- The historical TypeScript + direct DOM renderer preload path has been removed from Electron.
- The Angular bootstrap is standalone and zoneless. `zone.js` must not be reintroduced into the Angular workbench path.
- Angular build/lint/test targets are the canonical renderer pipeline.

## Target State
- Angular becomes the primary renderer/workbench framework.
- The Angular shell becomes the default renderer path in Electron.
- The legacy DOM renderer remains removed from the Electron runtime path.
- Theme and icon systems are adopted by the Angular shell before paused renderer feature work resumes.

## Package and Build Expectations

### Package Expectations
- `package.json` now contains the Angular 21 runtime and toolchain dependencies required for bootstrap, build, lint, and test execution.
- Angular migration work should stay on the latest supported Angular major unless an explicit ADR approves a hold-back.
- Runtime dependencies and Angular build tooling must stay aligned with `angular.json` and `apps/workbench/project.json`.

### Build Expectations
- `apps/workbench/project.json` still exposes the historical `tsc`-based build/test/watch path for TypeScript service/domain coverage, but Electron no longer uses that output as a renderer host.
- `angular.json` is the authoritative Angular CLI workspace contract for the workbench migration bootstrap.
- The Angular CLI workspace must remain zoneless: no `zone.js` polyfills, no `provideZoneChangeDetection`, and tests should use the zoneless Angular test environment.
- `apps/desktop-shell/project.json` must build the Angular renderer before launching Electron so the primary path is always fresh.
- Docs must describe Angular as the live primary renderer path and the DOM renderer as removed infrastructure.

## Renderer Execution Policy
- Only renderer migration work may proceed.
- Migration blocker fixes may proceed when they are necessary to unblock migration.
- Documentation, tracker, and package/dependency alignment work may proceed.
- Non-migration renderer feature implementation remains on hold until migration signoff.

## Migration-First Sequencing
1. `P0` Angular migration + docs/tracker alignment
2. `P1` Theme and icon foundations
3. `P2` Angular shell and layout system
4. `P3` Core panels and workflows
5. `P4` Resume paused feature work after migration signoff

## Resume Gate
Paused renderer feature work may not resume until all of the following are true:
- Angular shell is the primary renderer path.
- Legacy DOM renderer is removed.
- Docs, tracker, and package dependencies are aligned.
- Theme and icon systems are established.
- Shell supports right panel, AI chat surface, and run/debug/test architecture.
- Build, lint, and test pass.

## Verification
- `./node_modules/.bin/jest --config apps/workbench/jest.config.cjs --runInBand apps/workbench/src/boot/renderer-migration-alignment.spec.ts`
- `./node_modules/.bin/jest --config apps/workbench/jest.angular.config.cjs --runInBand`
- `yarn nx run workbench:build-angular`
- Reviewer confirms:
  - `tasks/TASKS.md` and `tasks/TRACKER.md` use migration-first sequencing
  - `docs/ARCHITECTURE.md` distinguishes current state from target state
  - `package.json`, `angular.json`, `apps/workbench/project.json`, and preload loader behavior match the documented migration stage
