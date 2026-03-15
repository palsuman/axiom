# Developer Setup (IDE-004)

## Prerequisites
- Node.js 20+
- Yarn 1.22.22 (`corepack prepare yarn@1.22.22 --activate`)
- Git
- macOS users: Homebrew (for `cmake` to build llama.cpp)

## Steps
1. Clone the repo.
2. Run `scripts/dev/setup.sh`:
   - Verifies Yarn/git versions.
   - Runs `yarn install --check-files`.
   - Installs `cmake` via Homebrew if missing.
   - Creates the `.nexus` data directory.
3. (Optional) Install local llama.cpp runtime: `scripts/dev/install-llamacpp.sh`.
4. Launch Nx builds to confirm environment: `yarn nx run workbench:build`.

## Scripts
- `scripts/dev/setup.sh`: idempotent bootstrap.
- `scripts/dev/install-llamacpp.sh`: clones + builds llama.cpp into `<NEXUS_DATA_DIR>/ai/llama.cpp` (defaults to `.nexus/ai/llama.cpp`).

## Env Var Summary
- `NEXUS_HOME` / `NEXUS_DATA_DIR`: override default `.nexus` path if needed.
- `NEXUS_LLAMACPP_ROOT` / `NEXUS_LLAMACPP_BINARY`: override the managed llama.cpp runtime path if needed.
- `NEXUS_REGISTRY_URL`: optional registry override for Yarn.

## Verification
Run `./scripts/dev/setup.sh` followed by `yarn nx run workbench:build` and ensure it succeeds.
