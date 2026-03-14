# Shared Config Packages

IDE-003 delivers `packages/configs`, a reusable toolkit for linting, formatting, TypeScript, and Jest settings.

## Structure
- `packages/configs/eslint/base.cjs` – root ESLint config.
- `packages/configs/prettier/base.cjs` – Prettier defaults.
- `packages/configs/ts/tsconfig.base.json` – strict TS baseline.
- `packages/configs/jest/jest.preset.cjs` – Jest preset referencing `ts-jest`.

## How to Consume
1. ESLint: root `.eslintrc.cjs` already re-exports the shared config. For project-specific overrides, create project `.eslintrc.cjs` that `module.exports = { ...require('../../packages/configs/eslint/base.cjs'), overrides: [...] }`.
2. Prettier: `.prettierrc.cjs` re-exports the shared module.
3. TypeScript: `tsconfig.base.json` extends `packages/configs/ts/tsconfig.base.json`. Per-project `tsconfig.json` should extend `../../tsconfig.base.json`.
4. Jest: When tests are added, create `jest.config.cjs` with `module.exports = require('../packages/configs/jest/jest.preset.cjs');`.

## Maintenance
- Update versions of ESLint, Prettier, ts-jest, and TypeScript in root `package.json` when bumping configs.
- Document any rule changes here + relevant ADR.
- Keep `.yarn/offline-cache` warmed with `yarn install --update-checksums` when adding new deps.
