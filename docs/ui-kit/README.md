# UI Kit Workbench Shell

This document is the authoritative contract for the Nexus workbench shell UI primitives implemented under `apps/workbench/src/shell` and `apps/workbench/src/commands`.

## Scope

The current shell contract covers:

- persistent workbench layout state for activity bar, sidebars, editor groups, panel, and status bar
- shell-level accessibility labels and roving-toolbar keyboard behavior
- the command palette and quick open surface used for command execution and navigation entry points

Related subsystem docs:

- `docs/ui-kit/theme-system.md` for theme token and runtime behavior
- `docs/ui-kit/i18n-runtime.md` for locale resolution and localized shell strings
- `docs/ui-kit/icon-module.md` for icon contracts and file icon resolution

## Owning Modules

- `apps/workbench/src/shell/workbench-shell.ts`
  - canonical shell state mutation API
- `apps/workbench/src/shell/workbench-layout-store.ts`
  - persisted shell layout snapshot storage
- `apps/workbench/src/shell/workbench-dom-renderer.ts`
  - renderer DOM mount, interaction wiring, and command palette shell
- `apps/workbench/src/commands/command-registry.ts`
  - typed command registration and execution contract
- `apps/workbench/src/commands/command-palette.ts`
  - provider-based quick open search aggregation
- `apps/workbench/src/commands/command-palette-controller.ts`
  - visible command palette state, keyboard routing, result selection, and command execution

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

## Verification

Targeted verification:

- `./node_modules/.bin/jest --config apps/workbench/jest.config.cjs --runInBand apps/workbench/src/commands/command-palette.spec.ts apps/workbench/src/commands/command-palette-controller.spec.ts apps/workbench/src/main.spec.ts`

Broader workbench verification:

- `yarn nx run workbench:test`
