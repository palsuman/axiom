# Nexus Milestones

| Phase | Description | Key Epics | Exit Criteria | Target Sprint Range |
| --- | --- | --- | --- | --- |
| Phase 0 – Foundations | Monorepo, tooling, CI, ADR governance, env policy. | Platform Foundations | Nx builds/smoke tests pass on clean clone; ADR/CI gates live. | S1 |
| Phase 1 – Core Workbench | Electron main/preload, renderer migration to Angular, performance budgets. | Electron Shell, Renderer Migration / Angular Workbench Target | Angular shell becomes the primary renderer path, command palette + dockable panels are available on that path, and startup remains <3s. | S2–S3 |
| Phase 2 – Workspace & Explorer | Workspace management, explorer CRUD/decorations, Monaco editor foundation. | Workspace System, File Explorer, Editor Platform | Multi-root workspace loads 50k files, explorer/edit/save functional with backups. | S4–S6 |
| Phase 3 – Extensions & Language Platform | Extension host, manifest/API surface, LSP infrastructure. | Extension Platform, Language Platform | Sample extension contributes commands/views; TS LSP diagnostics operational with sandboxing. | S7–S9 |
| Phase 4 – SCM/Terminal/Search | Git workflows, terminal PTY, search suite. | SCM, Terminal, Search | Staging/commit/branch flows, persistent terminal splits, streaming search results. | S10–S11 |
| Phase 5 – AI Core | llama.cpp controller, retrieval, guardrails, telemetry. | AI Core Infrastructure | Model discovery/import, streaming chat API, guardrail + benchmarking harness live. | S12–S13 |
| Phase 6 – AI Workflows | Chat, inline completion/edit, diagnostics explain, AI reviewers/agents. | AI IDE Features | AI UX surfaces ship with approvals + rollback, telemetry proves <300ms completion median. | S14–S15 |
| Phase 7 – Run/Debug/Test | Launch configs, DAP host, adapters, test explorer + coverage. | Run/Debug/Test | Node/Python debugging stable; Jest/Vitest explorer + coverage overlay functioning. | S16–S17 |
| Phase 8 – Hardening & GA | Security, observability, packaging, docs, perf verification. | Security, Observability, Packaging, Testing, Documentation | Signed installers Win/macOS/Linux, SBOM + telemetry consent, docs complete, DoD satisfied. | S18–S21 |
