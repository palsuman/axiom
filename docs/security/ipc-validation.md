# IPC Validation Layer (IDE-123)

## Scope
- Shared validators live in `packages/contracts/ipc-validation.ts`.
- Electron main-process enforcement lives in `apps/desktop-shell/src/bootstrap/bootstrap-desktop-shell.ts`.
- Coverage includes all current payload-bearing desktop IPC channels: workspace launch, Git, terminal, file operations, workspace backup, and renderer logging.

## Design
- Validation happens before a handler touches the filesystem, repository state, PTYs, or window/session state.
- Schemas normalize trusted values where useful, such as trimming user-supplied strings and constraining enums and integer ranges.
- Auth context remains in the main process: handlers still derive the calling window/session from `event.sender.id` after schema validation succeeds.
- Rejected payloads emit a consistent desktop log entry of the form `[ipc] rejected <channel> payload`, providing the telemetry trail required for security review.

## Testing
- Unit tests in `packages/contracts/ipc-validation.spec.ts` cover schema normalization and deep nested rejection paths.
- Main-process tests in `apps/desktop-shell/src/main.spec.ts` assert invalid payloads are rejected before window, Git, or terminal services are reached.

## Verification
- `yarn nx run contracts:test`
- `yarn nx run desktop-shell:test`
- `./node_modules/.bin/eslint packages/contracts apps/desktop-shell/src --ext .ts`
