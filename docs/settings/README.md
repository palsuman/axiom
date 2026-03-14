# Settings Schema + Registry

`IDE-106` establishes the typed settings foundation for Nexus. `IDE-107` adds the workbench-facing settings editor model, and `IDE-199` extends the same pipeline so theme selection flows through a shared runtime instead of isolated shell updates. The implementation now has three layers:

- `packages/platform/settings/settings-registry.ts` provides a shared registry for declaring settings, validating values, exporting a schema document, and resolving precedence across defaults, user values, and workspace overrides.
- `apps/workbench/src/settings/settings-service.ts` loads persisted user settings from `${NEXUS_HOME}/settings/user.json`, merges workspace descriptor settings from `.nexus-workspace.json`, applies shell-facing settings, owns the shared theme runtime, and exposes the resolved settings API to the workbench bootstrap.
- `apps/workbench/src/settings/settings-editor-service.ts` provides the dual-mode settings editor state used by the workbench: form sections, JSON text, search/filter, active scope, focused setting, and editor resources/commands for opening user or workspace settings.

## Precedence and scopes

Resolved values follow this order:

1. Setting default from the registry definition
2. User override from `${NEXUS_HOME}/settings/user.json`
3. Workspace override from `settings` inside the active workspace descriptor

Each setting also declares its allowed scope:

- `user`: only user settings may override it
- `workspace`: only workspace settings may override it
- `both`: either user or workspace values may override it

If a settings file provides an unknown key, an invalid value, or a value in the wrong scope, the registry rejects it and the workbench logs a console warning instead of crashing startup.

Workspace persistence rules are now explicit:

- user settings always persist to `${NEXUS_HOME}/settings/user.json`
- descriptor-backed workspaces persist to the active `.nexus-workspace.json` or `.code-workspace`
- folder workspaces persist workspace settings to `<workspace>/.nexus-workspace.json`

## Built-in foundation settings

The initial registry ships these built-in settings:

- `workbench.colorTheme`
- `workbench.locale`
- `window.zoomLevel`
- `files.encoding`
- `files.autoSave`
- `files.autoSaveDelay`
- `editor.tabSize`
- `editor.wordWrap`
- `terminal.integrated.fontSize`

The service already applies the resolved theme to `WorkbenchShell`, reflects locale/theme metadata onto `document.documentElement`, and keeps the shared theme runtime in sync with persisted settings. The editor service builds on that backend contract so settings changes made through the form or JSON surface stay synchronized immediately.

## Workbench API

`apps/workbench/src/main.ts` is now a thin entrypoint that re-exports `settingsService` and `settingsEditorService` from `apps/workbench/src/boot/bootstrap-workbench.ts`. The actual bootstrap composition lives in `apps/workbench/src/boot/workbench-bootstrap-context.ts`, while command wiring lives in `apps/workbench/src/boot/workbench-bootstrap-commands.ts`. The service layer exposes:

- `initialize()` to load persisted settings
- `get(key)` / `inspect(key)` for resolved reads
- `updateUserSettings(values)` and `updateUserSetting(key, value)` for mutations
- `updateSettings(scope, values)` and `updateSetting(scope, key, value)` for scope-aware mutations
- `removeUserSetting(key)` for cleanup
- `removeSetting(scope, key)` and `getScopeFilePath(scope)` for editor/tooling integrations
- `getSchema()` / `snapshot()` for UI and tooling consumers
- `getThemeRuntime()` to access the shared workbench theme runtime
- `onDidChange(listener)` for reactive integrations

The editor service exposes:

- `open({ scope, mode, query, focusKey })` to open user/workspace form or JSON surfaces
- `setQuery(query)` and `querySections(scope, query)` for search/filter
- `updateSetting(key, value, scope)` and `resetSetting(key, scope)` for GUI-backed edits
- `updateJsonText(text, scope)` for JSON-backed edits with immediate synchronization
- `getSnapshot()` / `onDidChange(listener)` for renderer bindings and tests

## Settings Editor Flow

- `nexus.settings.open` opens the form-oriented settings surface for `user` or `workspace` scope.
- `nexus.settings.openJson` opens the JSON-oriented settings surface for the selected scope.
- Command palette providers now expose both action entries (`Open User Settings`, `Open Workspace Settings`) and individual searchable setting entries.
- Form edits update persisted settings immediately and regenerate the JSON draft.
- Valid JSON edits replace the active scope contents immediately and refresh the form view.
- Invalid JSON is retained as editor state and surfaced as parse issues without mutating persisted settings.

## Theme Runtime Flow

- `workbench.colorTheme` remains a typed settings key declared in the shared registry.
- `SettingsService` translates that setting into `ThemeRuntime.setTheme(...)`, rather than resolving registry colors ad hoc in each UI surface.
- The active runtime snapshot then feeds:
  - shell CSS variables and metadata
  - editor theme conversion through `MonacoEditorService.bindThemeRuntime(...)`
  - terminal theme conversion through `TerminalHost.bindThemeRuntime(...)`
- The shared runtime now carries design tokens beyond color, so the same settings flow also drives:
  - workbench typography CSS variables
  - spacing/radius/focus tokens
  - icon sizing tokens
  - layout sizing tokens such as activity bar width and status bar height

This keeps theme state authoritative in one place and avoids renderer subsystems drifting onto separate color pipelines.

Hidden commands are also registered for test and integration use:

- `nexus.settings.inspect`
- `nexus.settings.update`
- `nexus.settings.editor.inspect`
- `nexus.settings.editor.json`
- `nexus.settings.editor.update`

## Verification

- `yarn nx run platform:test --runInBand`
- `yarn nx run workbench:test --runInBand`
