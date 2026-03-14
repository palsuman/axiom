# Workspace Open Service

The workspace open service coordinates every entry point for selecting, reopening, and switching Nexus workspaces.

## Responsibilities
- **Folder/descriptor picker IPC** – Renderer requests `nexus:pick-workspace`, the main process shows a native `openDirectory/.nexus-workspace.json` dialog, validates the selection (including VS Code-style descriptors), and returns the chosen absolute path.
- **Descriptor parsing** – `.nexus-workspace.json` (or `.code-workspace`) files declare multiple folders; `packages/platform/workspace/workspace-descriptor.ts` resolves them into `{ primary, roots[], label }`. Window state, MRU entries, and window titles all consume this normalized descriptor.
- **Recent workspace history** – Electron records launches via `WorkspaceHistoryStore` (`<NEXUS_WORKSPACE_DATA>/recent-workspaces.json`) and exposes them through `nexus:get-recent-workspaces`. Each entry now tracks descriptor path, primary root, and the full root set so the renderer can display accurate detail text and reopen multi-root workspaces.
- **Drag & drop** – The renderer registers a drop target on `document.body`; when a directory is dropped onto the workbench, the path is routed through `WorkspaceService.openWorkspace`.
- **Session restore** – On launch the main process restores stored window sessions; if none exist it automatically reopens the most recent workspace from history before falling back to a blank window.

## User flows
1. **Keyboard (`Cmd/Ctrl+O`)** → invokes `nexus.workspace.pickFolder` → native folder picker → active window reloads into the selected workspace.
2. **Command Palette** → “Open Workspace…” quick action or any entry from the MRU list.
3. **Drag folder** → drop anywhere on the workbench → IDE opens the dropped directory.
4. **Cold start** → Nexus restores last windows. If no sessions exist, it automatically opens the most recent workspace (descriptor-aware) before falling back to a blank window.

## Telemetry & future work
- Instrument `pickWorkspaceDirectory` results (success/cancel) once the telemetry epic (IDE-170) ships.
- When the trust model lands, guard drag-and-drop / picker requests behind untrusted workspace prompts.

## File watching & ignore rules (IDE-029)

- **Service entrypoint**: `packages/platform/workspace/workspace-watcher.ts` exposes `WorkspaceWatcher`, a typed wrapper around `chokidar` that normalizes events across multiple roots and enforces ignore policies.
- **Ignore sources**: default patterns (`.git`, `.nexus`, `node_modules`, IDE cache folders) plus optional `.gitignore`, `.nexusignore`, and per-feature overrides. All entries are piped through the `ignore` library to match VS Code semantics (POSIX rules, glob expansion).
- **Event contract**: listeners receive `{ type, root, absolutePath, relativePath }` so downstream systems (indexer, explorer, AI context builder) know which root produced the change without reparsing paths.
- **Ready & error hooks**: consumers can wait for all watchers to signal `ready` before indexing, and subscribe to error notifications for telemetry / UI surfacing.
- **Extensibility**: the watcher accepts a factory, allowing tests (and future remote FS providers) to supply mock implementations while production uses `chokidar`.
- **Performance guardrails**: `awaitWriteFinish`, deduped roots, and predicate-based ignores minimize churn on large repos (>100k files). Future phases can extend the factory to use platform-specific APIs (fsevents, watchdog) without touching consumers.

## Multi-root workspace model (IDE-027)

- **Descriptor schema**: `.nexus-workspace.json` supports `{ name, folders[], settings, tasks[] }`. Each folder entry accepts `path` (relative or absolute) plus optional `name`. Tasks require `{ id, command, type? }` where `type` defaults to `shell` and may be `npm` or `nx`.
- **Parser**: `loadWorkspaceDescriptor` now returns a `WorkspaceDescriptor` containing `folders`, `settings`, and normalized `tasks`. Relative folder paths resolve against the descriptor file, `~` expands to the user home, and duplicates are deduped.
- **Compatibility**: legacy `.code-workspace` files continue to work (folders + name only). Pointing to a plain folder path still produces a single-folder descriptor.
- **Consumer guidance**: downstream services (explorer layout, settings registry, workspace history) can inspect `descriptor.folders` and `descriptor.settings` to merge per-root configuration before bootstrapping views. Tasks can later surface in the run/debug palette.
- **Validation**: missing folders or malformed task entries throw descriptive errors, so invalid descriptors are rejected before they reach UI layers.

## Workspace state persistence (IDE-028)

- **Store**: `apps/workbench/src/workspace/workspace-state-store.ts` writes `<workspaceId>.state.json` under `${NEXUS_WORKSPACE_DATA}` capturing editor tabs, sidebar/panel focus, and SCM metadata. Files are versioned so future schema bumps can migrate cleanly.
- **Service**: `WorkspaceStateService` listens to `WorkbenchShell` layout events, debounces snapshots, and persists a trimmed set of editor entries (max 20) plus active view information. SCM modules can push lightweight state via `updateScmState`.
- **Restore flow**: During boot the renderer instantiates the service before opening default tabs. If persisted editors exist, they are reopened (with the previously active editor focused) and sidebar/panel visibility is reapplied. If no state is found, the IDE falls back to the welcome tab.
- **Extensibility**: future features (e.g., test explorer filters, terminal sessions) can attach their own payloads to the workspace state file without touching the core persistence flow; the service simply re-saves whenever subscribed components emit updates.

## Workspace backup & hot exit (IDE-149)

- **Manager**: `packages/platform/workspace/workspace-backup.ts` stores JSON snapshots under `<NEXUS_WORKSPACE_DATA>/backups/<workspaceId>/snapshot.json`, capped at 500 MB per workspace. Oversized payloads automatically prune oldest dirty documents, shrink terminal buffers, and drop stale run-config entries while logging `truncated=true` in the return value.
- **Renderer orchestrator**: `WorkspaceHotExitService` (`apps/workbench/src/workspace/workspace-hot-exit-service.ts`) aggregates dirty `TextModelManager` documents, terminal buffers, and future run/debug payloads, debounces writes via the preload IPC bridge, and clears backups whenever the workspace is clean. On startup it restores unsaved editors and replays the terminal scrollback before opening a fresh PTY so crashes feel lossless.
- **Terminal buffer capture**: `TerminalHost` now wraps a ring buffer (`terminal-snapshot-buffer.ts`) and exposes `captureSnapshot()`/`restoreFromSnapshot()` so explorer/search panes that depend on the terminal view get prefilled output after a restart.
- **Environment contract**: all backup paths respect `NEXUS_WORKSPACE_DATA` (defaulting to `.nexus/workspaces`), so enterprise policies can relocate snapshots by overriding `NEXUS_HOME`/`NEXUS_DATA_DIR` without code changes.
- **Testing & verification**: platform-level Jest specs cover size pruning and serialization, while renderer specs verify that dirty documents and terminal buffers survive a simulated crash and are cleared after a manual save.
