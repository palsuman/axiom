# Nexus Architecture Overview

## Renderer State
- **Primary state:** Electron now launches the Angular renderer/workbench shell by default from `apps/workbench/angular`.
- **Legacy DOM renderer:** removed from the Electron preload path.
- **Target state:** Angular remains the committed canonical renderer/workbench framework for all resumed renderer feature work.
- **Migration rule:** Until renderer migration signoff completes, only migration work, migration blocker fixes, and documentation/package alignment should proceed for the renderer.
- **Decision record:** [ADR-11](/Users/sumanpal/Developer/Projects/nexus/docs/adr/ADR-11.md) is the authoritative renderer framework decision and defines the migration completion and resume gate.
- **Retirement record:** [ADR-12](/Users/sumanpal/Developer/Projects/nexus/docs/adr/ADR-12.md) records the removal of the legacy DOM renderer from the Electron runtime path.
- **Alignment contract:** [renderer-migration.md](/Users/sumanpal/Developer/Projects/nexus/docs/architecture/renderer-migration.md) is the authoritative current-state/target-state/package-alignment document for the renderer migration.

## Layered View
1. **Electron Shell (Main + Preload)**
   - Manages windows, menus, auto-update, crash handling, file associations, env-detected `.nexus` directories.
   - Preload exposes audited, typed IPC bridges (fs, settings, telemetry, privacy, AI, extensions) with schema validation.
2. **Renderer / Angular Workbench Target**
   - Primary implementation: Angular shell host, standalone zoneless bootstrap, Angular command/theme host services, and CLI/Jest targets under `apps/workbench/angular`.
   - Legacy DOM renderer: removed from the preload/runtime path; the remaining TypeScript services and stores under `apps/workbench/src` are historical shell/domain modules and migration references, not an alternate renderer host.
   - Target implementation: Angular provides the primary layout shell (activity bar, docking, right utility panel, panels, status bar, AI chat surface, run/debug/test shell, i18n-aware UI components) and hosts feature modules.
   - Command registry + palette service already exist as shared renderer contracts and must be adopted by the Angular shell instead of duplicated.
3. **Shared Packages**
   - `packages/contracts`: TypeScript interfaces for IPC, extension APIs, prompt schemas.
   - `packages/platform`: domain-organized shared runtime contracts and services (`config`, `filesystem`, `observability`, `workspace`, `settings`, `theming`, `windowing`, `scm`, `run-debug`).
   - `packages/ui-kit`: current UI/shell primitives and theme docs; target scope includes reusable Angular components built on the same contracts.
   - `packages/editor-adapter`: Monaco configuration, model lifecycle helpers.
   - `packages/ai-core`: llama.cpp orchestration SDK, prompt DSL, telemetry hooks.
   - `packages/extension-host`: RPC protocol, sandbox enforcement, lifecycle manager.
4. **Background Services**
   - `services/indexer`: file watchers, symbol extraction, RAG chunking.
   - `services/telemetry`: structured event batching with privacy controls.
   - `services/updater`: signature validation, release channel orchestration.
5. **AI Runtime**
   - `ai-core` spawns llama.cpp subprocess with health checks, GPU/CPU scheduling, model registry, context providers (embeddings, snippets, AST heuristics).
6. **Extension Host**
   - Isolated Node process (per workspace) with permission model, activation events, resource quotas, diagnostics streaming, safe-mode integration.
7. **Data & Storage**
   - `.nexus` directories under `NEXUS_HOME`/`NEXUS_DATA_DIR` store settings, caches, workspace metadata, AI indexes, backups (see `docs/architecture/environment.md` for the authoritative env contract).
   - Indexed DB + sqlite for quick state; env overrides allowed for enterprise policy.

## IPC & Contracts
- Typed channels defined in `packages/contracts` with validation enforced both in preload and renderer.
- IPC categories: `workspace`, `fs`, `telemetry`, `ai`, `extension-host`, `terminal`, `debug`, `run-config`, `search`.
- Feature flags + permissions gate API access; untrusted workspaces restrict commands until trust granted.

## Extension Surface
- Manifest schema (JSON) validated at install time; contributions registered via command/menu/keybinding registries.
- Extension APIs exposed through proxy objects in sandbox: commands, workspace FS, terminals, editors, panels, AI hooks, diagnostics, tasks.
- Permission model defines scopes (fs, network, AI, secrets). Extension host enforces via capability filters.

## AI Data Flow
1. Feature module assembles prompt request (context, intent, guardrail metadata).
2. `ai-core` orchestrator fetches context from workspace index (chunks, symbols, git history) using retrieval heuristics.
3. llama.cpp controller streams tokens back through IPC; renderer surfaces incremental output with cancellation.
4. Guardrails (prompt injection filters, secret redaction, approval UX) ensure safe application of results.
5. Telemetry logged (latency, token usage, guardrail status) respecting privacy settings.

## Observability & Reliability
- Telemetry instrumentation aggregated via OpenTelemetry, stored locally when effective consent allows collection, with export/delete controls exposed through the privacy center.
- Crash reporter writes dumps, prompts safe mode, attaches logs.
- Feature flag service consumes config from local file or future remote endpoint.
- Diagnostics page surfaces health of AI, extension host, indexer, search, SCM, terminal subsystems.

## Security Controls
- Electron sandbox + strict CSP; no Node.js globals in renderer.
- IPC schema validation + fuzz tests; data sanitized before AI prompts.
- Secrets stored in OS keychain; logs redacted.
- Untrusted workspace model prevents task/debug/terminal execution until user trusts repo.
- Extension sandbox FS and resource quotas; safe mode + bisect for troubleshooting.
- Signed updates + SBOM and dependency scans prior to release.

## Scaling & Performance
- Nx workspace uses distributed cache; CI enforces affected-graph guardrails.
- Workspace handling uses incremental file watchers, chunked tree virtualization, large-workspace throttling heuristics.
- Editor supports pooling, lazy loading, large file degradation.
- Search + indexing pipeline leverages worker threads/service processes to avoid blocking UI.

## Localization
- Current renderer already owns locale/runtime switching contracts.
- Target Angular shell must consume the same locale contract and translation pipeline for resource bundling per locale.
- Telemetry logs missing translations for cleanup.

## Docs & Governance
- Architecture decisions captured in ADRs (`docs/adr/ADR-XXXX.md`).
- Product, architecture, monorepo, milestones, and tracker docs kept in repo root for transparency.
- Execution rules and structure standards live in `AGENTS.md` and `docs/governance/engineering-standards.md`.

## Package Organization Rules
- Shared packages use domain-first folders. Feature files should not accumulate at package roots.
- Cross-cutting capabilities should expose canonical shared modules before feature-level adoption.
- `packages/platform` currently uses:
  - `config`
  - `explorer`
  - `filesystem`
  - `observability`
  - `run-debug`
  - `scm/git`
  - `settings`
  - `theming`
  - `windowing`
  - `workspace`
- `packages/platform/observability` now contains:
  - `telemetry-store.ts` for local event buffering, replay, retention, and redaction
  - `privacy-consent-store.ts` for user/workspace consent persistence
- `packages/ai-core` now contains:
  - `controller/llama-controller.ts` for managed llama.cpp process lifecycle, health checks, restart policy, and runtime argument construction
  - `controller/llama-benchmark.ts` for reusable health benchmark execution and percentile summaries
- `packages/platform/theming` now contains:
  - `theme-token-catalog.ts` for the canonical design-token inventory and built-in defaults
  - `theme-registry.ts` for manifest/schema/inheritance resolution
  - `theme-runtime.ts` for live token propagation, overrides, and consumer adapters
- `packages/icons` now contains:
  - `icon-registry.ts` for icon definition registration, aliases, and themed icon resolution
  - `file-icon-resolver.ts` for deterministic file/folder icon selection
  - `icon-theme-service.ts` for binding icon resolution to the shared theme runtime, cache invalidation, and icon-cache telemetry
  - `builtin-icon-pack.ts` for the built-in codicon + curated file/folder icon definitions that ship with the Angular workbench
- The theming subsystem now covers semantic colors plus typography, spacing, icon sizing, and layout sizing tokens, with live adoption in workbench shell CSS variables, Monaco, and the integrated terminal.
- Root-level files in shared packages should be limited to metadata, config, and deliberate package entrypoints.

## App Organization Rules
- Applications follow the same domain-first rule as shared packages. Root `main.ts` and `preload.ts` files are allowed only as deliberate entrypoints.
- `apps/desktop-shell/src` currently uses:
  - `ai`
  - `bootstrap`
  - `filesystem`
  - `preload`
  - `run-debug`
  - `scm`
  - `system`
  - `terminal`
  - `windowing`
  - `workspace`
- `apps/workbench/src` currently uses:
  - `boot`
  - `commands`
  - `editor`
  - `explorer`
  - `i18n`
  - `observability`
  - `run-debug`
  - `scm`
  - `settings`
  - `shell`
  - `terminal`
  - `workspace`
- Within `apps/workbench/src`, large composition or shell files should be split again once they start mixing distinct responsibilities.
- The current renderer split is:
  - `boot/bootstrap-workbench.ts` as a thin entry module
  - `boot/workbench-bootstrap-context.ts` for service composition
  - `boot/workbench-bootstrap-contributions.ts` for shell/view/status providers
  - `boot/workbench-bootstrap-commands.ts` for command registration
  - `boot/workbench-bootstrap-runtime.ts` for terminal mount, workspace restore, and SCM startup
  - `run-debug/launch-configuration-editor-service.ts` for schema-backed launch configuration editing and renderer-side persistence flow
  - `run-debug/debug-session-store.ts` for debug session lifecycle snapshots, output buffering, and stack-frame updates
  - `settings/settings-service.ts` for persisted/resolved settings and theme runtime ownership
  - `settings/settings-editor-service.ts` for searchable form/JSON settings editor state and scope-aware workbench commands
  - `shell/workbench-shell.ts` as a facade over shell state, layout, and notification helpers
  - `shell/panel-host-service.ts` for declarative panel contribution registration and built-in output/problems panel state
  - `shell/workbench-shell-contract.ts`, `shell/workbench-shell-state.ts`, and `shell/workbench-shell-layout.ts` for focused shell internals
- The Angular bootstrap split is:
  - `angular/src/bootstrap.ts` for Angular host creation and `bootstrapApplication`
  - `angular/src/main.ts` as the browser entrypoint for the Angular renderer path
  - `angular/src/app/components` for standalone UI components with companion template/style/spec files
  - `angular/src/app/services` for bridge-aware shell/bootstrap services
  - `angular/src/app/models` and `angular/src/app/types` for renderer-facing contracts
  - `angular/src/app/providers` for DI tokens and bootstrapping providers
  - `angular/src/app/directives` and `angular/src/app/pipes` reserved for future Angular shell primitives
  - `angular/src/app/services/angular-theme-host.service.ts` for shared workbench `ThemeRuntime` ownership in the Angular bootstrap
  - `angular/src/app/services/angular-icon-theme-host.service.ts` for Angular consumption of the shared icon theme service and cache snapshots
  - `angular/src/app/services/angular-workbench-layout.service.ts` for Angular composition of the migrated activity bar, sidebars, editor area, panel, status bar, locale hooks, and shell snapshot
  - `angular/src/styles/icons.css` for the built-in codicon font/CSS import and curated Nexus file/folder icon asset classes
- Angular migration target:
  - Angular must become the primary renderer path.
  - The right activity bar, right utility panel, AI chat surface, and run/debug/test architecture must land on the Angular shell before paused renderer feature work resumes.
  - The legacy DOM renderer has been removed from the Electron runtime path and must not be reintroduced.
- App roots should not become feature buckets. If a subsystem grows beyond a single file, create a domain folder before the layout drifts.
- Run / Debug / Test documentation lives in `docs/run-debug-test/README.md`, which is the authoritative contract for `launch.json`, debug-session IPC/event channels, and verification commands.
