# Package Manager Strategy

## Overview
Nexus standardizes on **Yarn 1.22.22** with workspaces enabled. The repo enforces this via the `packageManager` field in `package.json`, `.yarnrc`, and `.npmrc`. Developers must use the bundled Yarn binary (via Corepack or `npm i -g yarn@1.22.22`) to ensure deterministic installs.

## Registry Configuration
- Default registry: `https://registry.npmjs.org` (set in `.yarnrc` + `.npmrc`).
- Enterprise override: set `NEXUS_REGISTRY_URL` in your shell, then run `yarn config set registry "$NEXUS_REGISTRY_URL"` or provide a `.npmrc.local` with the private Verdaccio/Artifactory address.
- `scripts/dev/setup.sh` will eventually detect and configure mirrors; today run `yarn config set yarn-offline-mirror ./ .yarn/offline-cache` (already set).

## Offline Cache / Verdaccio Mirror
- `.yarnrc` configures `yarn-offline-mirror` at `.yarn/offline-cache`. Run `yarn install --update-checksums` periodically to refresh tarballs.
- For CI/offline builds, populate the cache via `yarn install --cache-folder .yarn/offline-cache` or point to Verdaccio: `yarn config set registry http://localhost:4873`.
- TODO: add `scripts/dev/seed-offline-cache.mjs` once Verdaccio automation is available.

## Workspaces Layout
`package.json` now declares workspaces covering:
```
apps/*
packages/*
services/*
extensions/*
docs
tasks
```
This unlocks hoisted dependencies, consistent tooling, and Nx project discovery.

## Developer Checklist
1. Install Yarn 1.22.22 (e.g., `corepack prepare yarn@1.22.22 --activate`).
2. Run `yarn install` from repo root; verify `yarn --version` outputs 1.22.22.
3. (Optional) Mirror dependencies: `yarn install --offline` after cache warm-up or configure Verdaccio.
4. Keep `.yarn/offline-cache` committed (gitkeep only) but store tarballs via artifact storage/CI caching.

## CI Considerations
- CI should run `yarn config set cache-folder .yarn/offline-cache` before installs to maximize reuse.
- For air-gapped builds, ship `.yarn/offline-cache` artifacts along with installers.

## References
- Yarn Classic docs: https://classic.yarnpkg.com
- Verdaccio: https://verdaccio.org
