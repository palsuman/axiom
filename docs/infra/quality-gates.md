# Quality Gates (IDE-006)

IDE-006 wires lint, test, and type-check steps into Nx so CI can block regressions.

## Commands
- `yarn lint` → `nx run-many --target=lint`
- `yarn test` → `nx run-many --target=test`
- `yarn typecheck` → builds with production config to catch TS errors.

Each app defines targets:
- `lint`: `eslint apps/<project>/src --ext .ts`
- `test`: Jest with shared preset (`apps/<project>/jest.config.cjs`).
- `build`: TypeScript compilation (already added in IDE-005) serves as type-check.

## CI Hook
Update pipeline to run:
```bash
yarn lint
yarn test
yarn typecheck
```
Failing any of these stops merges per IDE-006 acceptance criteria.
