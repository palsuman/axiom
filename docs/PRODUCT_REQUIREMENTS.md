# Product Requirements – Nexus IDE

## Vision
Deliver a professional, AI-first desktop IDE that rivals IntelliJ IDEA and VS Code while remaining privacy-first through on-device llama.cpp models and a highly extensible plugin ecosystem.

## Target Personas
- **Polyglot SWE**: ships large TypeScript/Go/Java services, depends on advanced refactoring, SCM, debugging, and AI help without sending code to cloud.
- **AI-augmented DevOps engineer**: juggles infra repos, needs terminal-first workflows, task automation, and secure AI agents.
- **Extension partner**: builds custom workflows (tooling, dashboards, language packs) and needs stable APIs, permissions, and marketplace distribution.
- **Enterprise admin**: enforces policies, ensures signed updates, telemetry controls, and documentation for audits.

## Goals & Success Metrics
| Goal | Metric |
| --- | --- |
| Fast startup and workspace load | <3s cold boot P95, <5s load for 100k files |
| AI productivity | ≥80% of eval tasks solved with AI chat/edit features, <700ms retrieval |
| Extension ecosystem readiness | ≥10 built-in extensions using public APIs; manifest validation catching 100% schema errors |
| Enterprise readiness | Signed Win/macOS/Linux installers, SBOM export, telemetry opt-in/out |

## Core Capabilities
1. **Workbench Shell**: Angular-based layout with activity bar, multi-pane docking, command palette, panels (problems/output/AI), theming, localization.
2. **Workspace & Explorer**: Multi-root projects, fast tree virtualization, CRUD, Git decorations, virtual FS providers, crash recovery, `.nexus` storage via env vars (`NEXUS_HOME`, `NEXUS_DATA_DIR`).
3. **Editor Platform**: Monaco integration, text model lifecycle, diagnostics, navigation, formatting, CodeLens, diff/review mode, large file handling.
4. **Search**: Quick open, full-text search with streaming results, replace-in-files, optional persistent indexing.
5. **SCM & Terminal**: Git workflows (status, history, blame, stash, AI commits) plus PTY-backed terminal with splits, env templates, AI command suggestions.
6. **Run/Debug/Test**: Launch config schema, DAP host, multi-runtime adapters, breakpoint/watch views, test explorer + coverage overlays.
7. **Language Platform**: LSP manager, diagnostics pipeline, semantic tokens, snippets, offline grammar fallback, sandboxing + quotas.
8. **Extension Platform**: Manifest schema, sandboxed host, activation events, permissions, marketplace ingest/UI, resource quotas, diagnostics, dev flow.
9. **AI Platform**: llama.cpp controller, model registry, prompt orchestration, streaming/cancellation, RAG context service, guardrails, telemetry, benchmarking, AI UX features (chat, inline completion/edit, diagnostics explain, diff review, agents).
10. **Settings & Personalization**: Typed registry, GUI + JSON settings, keymap editor, theme/icon packs, policy/audit hooks.

## Non-Functional Requirements
- **Performance**: P95 startup <3s, command palette actions <100ms, editor nav <250ms, AI completion median <300ms.
- **Security**: contextIsolation true, IPC schema validation, CSP + sandbox, permissioned extensions, untrusted workspace mode, secrets redaction, signed updates, SBOM.
- **Reliability**: Crash reporter with safe mode, telemetry/health diagnostics, feature flags, workspace backups.
- **Privacy**: Offline-first AI, privacy toggle blocking network egress, env-based data directories.
- **Localization & Accessibility**: i18n infrastructure, locale switcher, Axe/ARIA compliance, keyboard-first navigation.

## Key AI Experiences
- AI chat side-panel with repo-aware context, slash commands, streaming responses, history per workspace.
- Inline completion + edit/refactor with diff preview, rollback log, guardrail approvals.
- Diagnostic explanations/fixes, test/doc generation, AI commit messages, terminal command coaching, AI diff reviewer scoreboard.
- Agent runner for multi-step plans gated by approvals and telemetry.

## Extensibility Requirements
- Manifest schema covering commands, menus, keybinds, panels, languages, tasks, themes, FS providers.
- Sandboxed extension host with activation events, lifecycle telemetry, crash isolation, safe mode & bisect.
- Marketplace ingest/UI, signing, enterprise catalog policies, offline import/export.
- Extension diagnostics dashboard, developer linking/hot-reload workflow, version negotiation and resource quotas.

## Compliance & Packaging
- Cross-platform Electron builds, signed installers, delta updates, offline bundles, artifact verification CLI.
- SBOM generation, vulnerability scanning gating releases, release playbooks + documentation for audits.

## Observability & Testing
- Structured telemetry (opt-in/out, export), OpenTelemetry traces, health page, alert webhooks.
- Comprehensive test automation: unit, integration, visual regression, AI eval + red-team suite, extension compatibility, chaos tests.

## Dependencies & Assumptions
- Nx/Turborepo for monorepo orchestration, Yarn as package manager.
- local llama.cpp binary with GGUF models; optional GPU offload.
- Env vars and `.nexus` directories must exist before runtime; installers bootstrap defaults.
- CI/CD infrastructure available for multi-platform builds and signing.
