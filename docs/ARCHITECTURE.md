# Nexus Architecture Overview

## Layered View
1. **Electron Shell (Main + Preload)**
   - Manages windows, menus, auto-update, crash handling, file associations, env-detected `.nexus` directories.
   - Preload exposes audited, typed IPC bridges (fs, settings, telemetry, AI, extensions) with schema validation.
2. **Angular Workbench (Renderer)**
   - Provides layout shell (activity bar, docking, panels, status bar, i18n-aware UI components) and hosts feature modules (Explorer, SCM, Search, AI, etc.).
   - Command registry + palette service supply fuzzy-searched quick open across commands/recent files, honoring keybindings + locale metadata and driving the renderer command palette UI.
3. **Shared Packages**
   - `packages/contracts`: TypeScript interfaces for IPC, extension APIs, prompt schemas.
   - `packages/platform`: workspace models, state stores, indexing clients.
   - `packages/ui-kit`: reusable Angular components + theme tokens.
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
- IPC categories: `workspace`, `fs`, `telemetry`, `ai`, `extension-host`, `terminal`, `debug`, `search`.
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
- Telemetry instrumentation aggregated via OpenTelemetry, stored locally until consent.
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
- Angular i18n service + locale switcher; translation pipeline ensures resource bundling per locale.
- Telemetry logs missing translations for cleanup.

## Docs & Governance
- Architecture decisions captured in ADRs (`docs/adr/ADR-XXXX.md`).
- Product, architecture, monorepo, milestones, and tracker docs kept in repo root for transparency.
