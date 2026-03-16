# Nexus Monorepo Structure

```
.
├── apps/
│   ├── desktop-shell/        # Electron main + preload entrypoints, auto-update, OS hooks
│   ├── workbench/            # Current TS renderer/workbench; migration target is Angular
│   └── agent-runner/         # Optional CLI/agent harness for AI automation + testing
├── packages/
│   ├── contracts/            # Shared IPC & API typings
│   ├── platform/             # Workspace models, services, stores
│   ├── ui-kit/               # Current shell/UI primitives; target scope includes Angular component library, theming, localization helpers
│   ├── editor-adapter/       # Monaco configuration, text model lifecycle utilities
│   ├── ai-core/              # llama.cpp orchestration SDK, prompt DSL, guardrails
│   └── extension-host/       # Sandbox runtime, RPC transport, activation registry
├── services/
│   ├── indexer/              # File watching, symbol extraction, RAG chunking workers
│   ├── telemetry/            # Structured logging, consent buffering, exporter pipeline
│   └── updater/              # Release channels, signature validation
├── extensions/
│   ├── builtin/              # First-party extensions (git, search, ai, terminal, etc.)
│   └── samples/              # Partner reference implementations + tests
├── scripts/
│   ├── dev/                  # Onboarding scripts, env checks, llama.cpp setup
│   ├── release/              # Packaging, signing, changelog automation
│   └── qa/                   # Test harness runners, benchmark orchestration
├── configs/
│   ├── eslint/               # Shared lint configs
│   ├── prettier/
│   ├── tsconfig/
│   └── bundler/              # Webpack/Vite/Electron builder configs
├── resources/
│   ├── installers/           # Icons, manifests, EULA, branding assets
│   ├── icons/
│   └── legal/
├── infra/
│   ├── ci/                   # CI pipelines, Nx cache wiring, verification jobs
│   ├── docker/               # Devcontainer + local services
│   └── helm/                 # Optional deployment assets for services
├── docs/
│   ├── adr/                  # Architecture Decision Records (ADR-0001+)
│   ├── architecture/
│   ├── user/
│   └── api/
├── tasks/                    # Planning + backlog docs (TASKS.md, TRACKER.md)
└── .nexus/ (per-user/workspace) # Populated at runtime using NEXUS_HOME/NEXUS_DATA_DIR
```

## Tooling & Governance
- **Nx/Turborepo** orchestrates builds/tests/lint per project.
- **Yarn workspaces** manage dependencies; `.yarnrc` locks registry + offline cache.
- **Feature flags** stored under `configs/flags` for renderer + main process.
- **Env defaults** stored in `.env.example`; runtime reads `NEXUS_HOME`/`NEXUS_DATA_DIR`.

## Code Ownership
- `apps/desktop-shell`, `packages/extension-host`, `services/updater` → Platform team.
- `apps/workbench`, `packages/ui-kit`, `packages/editor-adapter` → Frontend team.
- `packages/ai-core`, `services/indexer` → AI team.
- `extensions/`, `packages/contracts` → Extension team.
- `infra/`, `scripts/release` → Infra team.
- `docs/`, `tasks/` → Shared, QA ensures compliance.
