# Editor Platform – Monaco Integration (IDE-041)

## Goals
- Provide a reusable Monaco loader that works in offline mode with assets hosted under `NEXUS_HOME/.nexus/monaco` or bundled with the Electron app.
- Support multiple simultaneous editors backed by shared Monaco models so tabs/splits stay in sync.
- Ensure theming reacts to workbench tokens and respects the current locale/accessibility settings.
- Keep implementation browser-safe: Electron renderer only, never touching Node APIs directly.

## Architecture

### Loader (`apps/workbench/src/editor/monaco-loader.ts`)
1. Resolves a base path (defaults to `/monaco/vs`) and injects `loader.js` at runtime. Teams can host Monaco bits under `<NEXUS_DATA_DIR>/monaco` and expose them through the dev server/prod bundle.
2. Configures AMD `require` paths and `MonacoEnvironment.getWorkerUrl`, generating a data-URL bootstrapper that loads worker scripts from the same base path (works offline, no CDN calls).
3. Caches the loaded Monaco API; repeated calls return the same instance without reinjecting scripts.
4. Exposes `isLoaded()` so callers can defer theme application until Monaco is actually available.

### Editor service (`apps/workbench/src/editor/monaco-service.ts`)
1. Accepts simple `MonacoEditorInit` descriptors (URI, language, initial value, tabSize, readonly).
2. Pools Monaco models by URI, reference-counting them as editors open/close. When the last editor using a model is disposed the model is disposed to free memory.
3. `updateWorkbenchTheme` converts workbench tokens into Monaco theme definitions and editor options. Theme updates queue if Monaco isn’t loaded yet and apply automatically as soon as the loader resolves.
4. `bindThemeRuntime(...)` subscribes Monaco to the shared `ThemeRuntime`, using `toMonacoThemeDefinition(...)` so editor colors, font family, font size, and line height stay aligned with the shell and terminal.
5. Reapplies runtime-derived editor options to already-open editors, so typography changes do not require reopening editors.
6. Provides helper APIs (`updateModelContent`, `disposeEditor`, `disposeAll`) used by docked editors, diff views, AI inline previews, etc.

## Usage
```ts
const editorService = new MonacoEditorService({ basePath: '/monaco/vs' });
await editorService.updateWorkbenchTheme('nexus-dark', {
  base: 'vs-dark',
  foreground: '#f3f3f3',
  background: '#1e1e1e'
});

const editor = await editorService.createEditor({
  container: hostElement,
  uri: 'file:///workspace/src/app.component.ts',
  language: 'typescript',
  value: sourceText
});
```

When shipping the Electron bundle, include the Monaco distribution under `resources/monaco/vs` (or configure `basePath` to point at a `.nexus` directory). Workers load via generated `data:` URLs so no `file://` CSP tweaks are required.

## Theme Flow
- The canonical theme source lives in `packages/platform/theming/theme-runtime.ts`.
- `SettingsService` owns the active runtime and updates it from `workbench.colorTheme`.
- `MonacoEditorService.bindThemeRuntime(...)` consumes runtime snapshots and converts them into Monaco theme definitions without duplicating resolution rules in the editor layer.
- The runtime now carries design tokens beyond color, so Monaco also adopts shared typography tokens (`font.family.mono`, `font.size.md`, `font.lineHeight.normal`) from the same pipeline.
- This keeps Monaco on the same semantic token pipeline as shell CSS variables and the integrated terminal.

### Text model manager (`apps/workbench/src/editor/text-model-manager.ts`)
IDE-042 extends the editor platform with a persistence-aware text model lifecycle controller:

1. Caches open documents keyed by URI, capturing encoding, line endings, dirty state, and the last saved timestamp so workbench tabs can reflect accurate status badges.
2. Wires autosave policies (`off` or `afterDelay`) and throttles writes to storage adapters. Dirty models trigger autosave timers that resolve through the persistence adapter while surfacing telemetry events when failures occur.
3. Normalizes line endings and tracks encoding switches before saving, guaranteeing that toggling between `LF`/`CRLF` or UTF encodings results in consistent disk writes and Monaco model options.
4. Exposes `bindMonacoModel` so Monaco text models can stream changes directly into the lifecycle manager—handy for inline diff editors and AI previews that share URIs.
5. Supports non-persistent/virtual documents (e.g., welcome pages) without touching disk, keeping autosave timers disabled for read-only buffers.

Usage sketch:

```ts
const storage = new FsDocumentAdapter();
const lifecycle = new TextModelManager({ storage, autosaveDelayMs: 500 });
await lifecycle.openDocument({ uri: 'file:///repo/app.ts', languageId: 'typescript' });

const model = await monaco.editor.createModel(/* ... */);
const detach = lifecycle.bindMonacoModel('file:///repo/app.ts', model);

lifecycle.onDidChange(event => {
  if (event.type === 'dirty-change') {
    shell.updateTabDirtyBadge(event.uri, event.dirty);
  }
});
```

Extensions or core services can plug in custom adapters (e.g., remote FS providers) by implementing the `DocumentStorageAdapter` interface, letting them reuse autosave/dirty semantics without duplicating logic.

### Capability bridge (`apps/workbench/src/editor/editor-capability-bridge.ts`)
IDE-043 introduces a thin orchestration layer between the command palette and Monaco:

1. Maintains the currently active editor instance and applies view-wide options such as minimap visibility, folding enablement, and bracket matching preferences whenever focus shifts.
2. Registers core editing commands (`undo`, `redo`, add cursor above/below, capability toggles) with the shared `CommandRegistry`, ensuring the command palette/menus can route actions without touching Monaco internals.
3. Emits lightweight telemetry events so future instrumentation (perf budgets, feature usage) can subscribe without importing renderer-specific code.
4. Provides snapshot + toggle APIs so settings panels can read/flip capability states without requiring an editor to be focused—queued changes apply automatically when an editor becomes active.

This keeps editor UX features testable in isolation while giving future settings UI a single surface to mutate behaviour.
