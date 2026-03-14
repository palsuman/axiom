# Run / Debug / Test

## Purpose
This subsystem owns the run/debug contract across shared schemas, Electron IPC, and renderer state. The delivered MVP now includes:
- schema-backed `launch.json` editing and persistence
- a DAP-compatible debug adapter host in the desktop shell
- a first-party Node adapter process for launch-based sessions
- renderer-side debug session state, output, stack frame selection, persisted breakpoints, and persisted watch expressions
- MVP caveat: the bundled Node adapter currently prioritizes deterministic launch/session flow plus deterministic breakpoint/watch contracts; runtime-accurate source-level debugging still expands in follow-on adapter tasks.

## Ownership Boundary
- `packages/platform/run-debug`
  - Canonical `launch.json` validation/serialization
  - DAP wire protocol framing/parser shared by host + adapters
- `packages/contracts`
  - Typed IPC request/response/event contracts for run config and debug sessions
  - IPC payload validation for debug lifecycle channels
- `apps/desktop-shell/src/run-debug`
  - Launch configuration persistence service
  - Debug adapter host lifecycle (`start`, `stop`, cleanup on session close)
  - First-party Node debug adapter (`adapters/node-debug-adapter.ts`)
- `apps/workbench/src/run-debug`
  - Launch configuration editor service
  - Debug session store for active session snapshot, stack frames, persisted breakpoints, watch evaluation, and output

## Storage Contract
- Workspace run configurations live at `.nexus/launch.json` under the active workspace root.
- Workspace breakpoint/watch UI state lives in the workbench workspace data root as `<workspace-id>.debug.json`.
- If the file does not exist, the desktop shell returns a default in-memory document:

```json
{
  "version": "1.0.0",
  "configurations": []
}
```

- Saves are normalized through the shared serializer before hitting disk.
- Invalid JSON or schema violations are returned as issues and never overwrite the last valid file.
- Persisted debug UI state includes breakpoints `{ source, line, enabled }`, watch expressions `{ expression }`, and the selected stack frame id.
- Watch expression definitions survive renderer restarts, but evaluated values remain session-scoped and are recomputed on the next stopped event.

## Public Contract
### JSON Schema
- Schema URI: `https://schema.nexus.dev/run-debug/launch-configuration.schema.json`
- Required root fields:
  - `version`
  - `configurations`
- Supported configuration fields:
  - `name`
  - `type`
  - `request`
  - `program`
  - `cwd`
  - `args`
  - `env`
  - `preLaunchTask`
  - `stopOnEntry`
  - `console`

### IPC Channels
- `nexus:run-config:load`
  - Returns `{ path, exists, text, issues }`
- `nexus:run-config:save`
  - Accepts `{ text }`
  - Returns `{ path, saved, text, issues }`
- `nexus:debug:start`
  - Accepts `{ configurationName?, configurationIndex?, stopOnEntry?, breakpoints? }`
  - Returns a `DebugSessionSnapshot`
- `nexus:debug:stop`
  - Accepts `{ sessionId?, terminateDebuggee? }`
  - Returns `{ sessionId, stopped, state }`
- `nexus:debug:evaluate`
  - Accepts `{ sessionId?, frameId?, expression, context }`
  - Returns `{ sessionId, frameId?, expression, result, type? }`
- `nexus:debug:event`
  - Main-to-renderer event stream containing session lifecycle/output updates

### Renderer UX
- Sidebar view: `view.run`
- Sidebar capabilities:
  - launch configuration access
  - breakpoint list management
  - watch expression management
  - call stack frame selection
- Commands:
  - `nexus.run.focus`
  - `nexus.run.configurations.open`
  - `nexus.run.configurations.openJson`
  - `nexus.run.configurations.refresh`
  - `nexus.run.debug.start`
  - `nexus.run.debug.stop`
- Editor resources:
  - `run-config://form`
  - `run-config://json`
- File editor placeholders expose a synthetic breakpoint gutter until Monaco is mounted.

## Debug Session Lifecycle
1. Renderer requests `nexus:debug:start`.
2. Host loads and validates `.nexus/launch.json`, resolves target configuration.
3. Host starts adapter process, performs DAP `initialize`, applies persisted enabled breakpoints through `setBreakpoints`, then `launch`/`attach` + `configurationDone`.
4. Adapter events (`stopped`, `continued`, `output`, `terminated`) are forwarded over `nexus:debug:event`.
5. On `stopped`, host fetches stack frames via DAP and includes them in session snapshots.
6. Renderer evaluates watch expressions for the selected stack frame through `nexus:debug:evaluate`.
7. Session ends through `nexus:debug:stop`, renderer close, or target termination.

## Verification Path
- Contracts: `NX_DAEMON=false yarn nx run contracts:test --skip-nx-cache`
- Shared platform: `NX_DAEMON=false yarn nx run platform:test --skip-nx-cache`
- Desktop shell: `NX_DAEMON=false yarn nx run desktop-shell:test --skip-nx-cache`
- Workbench: `NX_DAEMON=false yarn nx run workbench:test --skip-nx-cache`
- Build validation:
  - `NX_DAEMON=false yarn nx run desktop-shell:build --skip-nx-cache`
  - `NX_DAEMON=false yarn nx run workbench:build --skip-nx-cache`

## Follow-on Tasks
- `IDE-157` introduces multi-runtime adapters (Node/Python/Go) with marketplace plumbing.
- `IDE-069` wires `preLaunchTask` through the task runner pipeline.
