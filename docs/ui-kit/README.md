# UI Kit Workbench Shell

This document is the authoritative contract for the Nexus workbench shell UI primitives implemented under `apps/workbench/src/shell` and `apps/workbench/src/commands`.

## Scope

The current shell contract covers:

- persistent workbench layout state for activity bar, sidebars, editor groups, panel, and status bar
- a declarative panel host used for terminal, output, problems, and future extension-contributed panels
- shell-level accessibility labels and roving-toolbar keyboard behavior
- the command palette and quick open surface used for command execution and navigation entry points
- Angular shell composition parity for activity bar, sidebars, editor area, panel docking, locale hooks, and status bar integration under `apps/workbench/angular`

Related subsystem docs:

- `docs/ui-kit/theme-system.md` for theme token and runtime behavior
- `docs/ui-kit/i18n-runtime.md` for locale resolution and localized shell strings
- `docs/ui-kit/icon-module.md` for icon contracts and file icon resolution

## Owning Modules

- `apps/workbench/src/shell/workbench-shell.ts`
  - canonical shell state mutation API
- `apps/workbench/src/shell/workbench-layout-store.ts`
  - persisted shell layout snapshot storage
- `apps/workbench/src/shell/panel-host-service.ts`
  - declarative panel contribution registry and built-in panel content models
- `apps/workbench/src/commands/command-registry.ts`
  - typed command registration and execution contract
- `apps/workbench/src/commands/command-palette.ts`
  - provider-based quick open search aggregation
- `apps/workbench/src/commands/command-palette-controller.ts`
  - visible command palette state, keyboard routing, result selection, and command execution
- `apps/workbench/angular/src/app/services/angular-workbench-layout.service.ts`
  - Angular composition layer that reuses the historical layout/i18n contracts and exposes a real shell snapshot for the migrated renderer
- `apps/workbench/angular/src/app/components/workbench-shell/workbench-shell.component.ts`
  - Angular workbench shell component that renders the migrated activity bar, sidebars, editor area, panel, and status bar

## Command Palette Contract

`IDE-020` completes the first-party command palette shell.

Behavior:

- `Cmd+Shift+P` on macOS and `Ctrl+Shift+P` on Windows/Linux opens the palette.
- The palette performs fuzzy search across registered commands and first-party quick open providers.
- Selecting an item executes its `commandId` through the shared `CommandRegistry`.
- Item metadata is forwarded as command args, which is how quick open entries open workspaces, switch locale, jump to settings, or open run/debug resources.
- `ArrowUp`, `ArrowDown`, `Enter`, and `Escape` are handled while the palette input is focused.

Current first-party providers:

- command registry entries
- recent workspaces and workspace-open action
- locale switcher
- launch configuration entries/actions
- settings and privacy center entries

Extension-contributed palette entries remain future work under the extension-platform tasks.

## Panel Host Contract

`IDE-147` introduces the workbench panel host abstraction.

Behavior:

- Panels are registered declaratively through `PanelHostService.registerContribution(...)`.
- Registration updates the shared shell panel tabs using the same `PanelViewRegistration` contract consumed by the workbench layout state.
- Panel docking remains owned by `WorkbenchShell`, so switching bottom/right positions and the active panel persists through the existing layout store.
- Built-in panel contributions now cover:
  - `panel.terminal`
  - `panel.output`
  - `panel.problems`

Current panel commands:

- `nexus.panel.focusTerminal`
- `nexus.panel.focusOutput`
- `nexus.panel.focusProblems`
- `nexus.panel.position.bottom`
- `nexus.panel.position.right`

The panel host is the renderer-facing contract that future extension manifests and contribution APIs should target when panel contributions are surfaced through the extension platform.

## Verification

Targeted verification:

- `./node_modules/.bin/jest --config apps/workbench/jest.config.cjs --runInBand apps/workbench/src/commands/command-palette.spec.ts apps/workbench/src/commands/command-palette-controller.spec.ts apps/workbench/src/main.spec.ts`
- `./node_modules/.bin/jest --config apps/workbench/jest.config.cjs --runInBand apps/workbench/src/shell/panel-host-service.spec.ts apps/workbench/src/shell/workbench-layout-store.spec.ts apps/workbench/src/main.spec.ts`

Broader workbench verification:

- `yarn nx run workbench:test`
- `yarn nx run workbench:test-angular`
- `yarn nx run workbench:build-angular`
