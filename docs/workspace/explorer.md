# Explorer Tree Module (IDE-034)

## Responsibilities
- Maintain a normalized, multi-root tree sourced from `WorkspaceDescriptor` instances.
- Stream high-volume file system changes from `WorkspaceWatcher` into UI-friendly node views.
- Provide asynchronous directory loading so collapsed folders defer IO until expanded.
- Offer virtualization-friendly snapshots so the renderer only paints what is visible.
- Surface pending loads, errors, and telemetry hooks for future instrumentation.

## Architecture
1. **Model layer** – `ExplorerTreeModel` (packages/platform) stores canonical nodes, sorts folder/file groups, and exposes `getVisibleNodes()`. It is fed by descriptors, data providers, and watcher events.
2. **Virtualization** – `TreeVirtualizer` computes slices based on row height and viewport metrics to keep scroll performance under the 50 ms jank budget.
3. **Renderer store** – `ExplorerStore` (apps/workbench) owns async loading, caching, and subscriber notifications. It requires an `ExplorerDataProvider` to read directories (currently wired to IPC/Node providers) and exposes immutable `ExplorerSnapshot`s for Angular or future view layers.
4. **Provider boundary** – The renderer never touches `fs`. A provider implementation running through the preload bridge requests directory listings (`nexus.explorer.readDirectory`) and streams watcher events (`nexus.explorer.onEvent`). Providers run against user/workspace paths resolved via the `.nexus` persistence rules (`NEXUS_HOME`, `NEXUS_WORKSPACE_DATA`).
5. **i18n readiness** – All UI strings (empty state, loading text, errors) will route through the runtime i18n service (IDE-181) so file explorer labels honor user locale from day one.

## Data flow
1. Renderer receives descriptor metadata during window bootstrap and calls `ExplorerStore.initialize(descriptor)`.
2. Store seeds root nodes, optionally auto-expanding a single root, and begins async directory loads via provider.
3. When the user expands a folder, `ExplorerStore.expand(path)` ensures children are loaded exactly once, updates virtualization, and emits a new snapshot.
4. `WorkspaceWatcher` (main/Node) emits events which are forwarded via IPC. `ExplorerStore.handleWorkspaceEvent(event)` applies incremental updates without reloading entire roots.
5. UI surfaces subscribe via `onDidChange` to bind `snapshot.virtualSlice.items` into a virtual scroll viewport. Pending loads and per-path errors inform badges/spinners.

## Extensibility & next steps
- **Decorations/API** – Tree nodes carry `id`, `path`, `depth`, and `rootIndex`, enabling later decoration providers (Git, problems, AI suggestions) to map overlays without recomputing hierarchy.
- **Extension hooks** – Once IDE-039/IDE-150 land, extensions can register context menu entries or virtual FS providers that feed additional `ExplorerDirectoryEntry` rows.
- **Accessibility** – Virtualized output retains deterministic ordering, easing screen reader narration when paired with runtime locale strings.
- **Telemetry** – `ExplorerStore` exposes `pendingPaths` and `lastUpdated` so the metrics service can measure IO latency per root and ensure the <50 ms jank goal remains true across themes/locales.

## File operations & undo pipeline (IDE-035)

1. **Engine** – `packages/platform/file-operations.ts` (`FileOperationsEngine`) owns all filesystem mutations. Every request carries the current workspace roots so operations cannot escape the project boundary. Paths are normalized and validated before touching disk.
2. **Electron service** – `apps/desktop-shell/src/file-operations.ts` wires IPC channels (`nexus:fs:create|rename|move|copy|delete|undo`) to the engine, resolving the correct workspace roots for each window.
3. **Trash + undo** – Deletes move items into `<NEXUS_WORKSPACE_DATA>/trash/<batch-id>/…` instead of removing them permanently. Each operation returns an `undoToken`; calling `fsUndo` replays the inverse action (e.g., move back from trash, rename to the previous location, remove copied artifacts). Tokens expire after five minutes and stale trash batches are cleaned automatically.
4. **Renderer bridge** – `ExplorerActions` wraps the `window.nexus` APIs, adds optimistic status via `ExplorerStore.addOptimisticPaths`, and clears the pending indicators once the IPC promise resolves. Even before chokidar events propagate, the UI can show “in-flight” state for touched resources.
5. **Error handling** – All operations attempt best-effort rollbacks if intermediate steps fail (renames revert, copies are removed, trash batches are restored). Undo operations surface failures to the caller so the UI can prompt the user when a rollback is no longer possible (e.g., when another process mutated the same file).
