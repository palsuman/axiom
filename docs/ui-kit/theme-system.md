# Theme System (IDE-198, IDE-199, IDE-202)

## Scope
- Shared token catalogs and defaults live in `packages/platform/theming/theme-token-catalog.ts`.
- Shared theme manifests and registration live in `packages/platform/theming/theme-registry.ts`.
- Shared runtime token propagation and scoped override handling live in `packages/platform/theming/theme-runtime.ts`.
- The canonical semantic contract now drives shell CSS variables, Monaco editor theme definitions + editor typography, integrated terminal colors + terminal typography, and shared sizing/icon tokens from one source of truth.
- Built-in themes ship as registry manifests: `Nexus Dark`, `Nexus Light`, and `Nexus High Contrast`.

## Manifest Contract
- Theme manifests declare `id`, `label`, `kind`, optional `extends`, optional `uiBaseTheme`, and optional token sections:
  - `colors`
  - `typography`
  - `spacing`
  - `icons`
  - `layout`
- `kind` controls the default fallback palette (`light`, `dark`, `high-contrast`) when a manifest does not extend another theme.
- `extends` layers a child theme on top of an already-registered parent theme.
- Unknown token slots, malformed values, duplicate IDs, and missing parents are rejected at registration time with actionable errors.

## Token Categories
- `colors`
  - semantic chrome, lists, panels, tabs, inputs, notifications, diagnostics, SCM states, editor surfaces, terminal palette
- `typography`
  - UI/mono font families, size scale, weights, line-height scale
- `spacing`
  - spacing scale, radii, focus outline width
- `icons`
  - shared icon sizing scale
- `layout`
  - shell/control sizing such as activity bar width and status bar height

## CSS Variable Naming
- CSS variables are generated directly from canonical token slot names using kebab-case naming, for example:
  - `workbench.background` -> `--nexus-workbench-background`
  - `font.family.mono` -> `--nexus-font-family-mono`
  - `activityBar.width` -> `--nexus-activity-bar-width`
- The system no longer keeps legacy alias variables such as `--nexus-panel-bg` or `--nexus-terminal-fg`. Consumers must use the canonical generated names.

## Runtime Contract
- `ThemeRuntime` owns the active theme selection, fallback theme, scoped overrides, revisioning, and change notifications.
- `IconThemeService` can bind to the same runtime so icon variant selection and icon/file cache invalidation follow the active workbench theme revision.
- The runtime snapshot exposes:
  - the resolved active theme
  - merged token sections after override application
  - generated CSS variables
  - the active override state by scope
- Scoped overrides are layered in deterministic order:
  1. Registry-resolved theme tokens
  2. `default` overrides
  3. `user` overrides
  4. `workspace` overrides
  5. `contrast` overrides
- Invalid override slots and invalid token values are rejected before they can mutate runtime state.

## Derived Consumers
- `toCssVariables(...)` exposes the shell-facing CSS token map.
- `toMonacoThemeDefinition(...)` converts the shared snapshot into Monaco color + typography inputs.
- `toTerminalThemeDefinition(...)` converts the same snapshot into xterm palette + typography inputs.

## Current Consumers
- `apps/workbench/src/settings/settings-service.ts`
  - populates the `workbench.colorTheme` enum from the registry
  - owns the shared `ThemeRuntime`
  - applies runtime CSS variables and theme metadata onto `document.documentElement`
  - keeps `WorkbenchShell` aligned with the active runtime snapshot
- `apps/workbench/src/editor/monaco-service.ts`
  - binds to the shared runtime through `bindThemeRuntime(...)`
  - reapplies Monaco theme definitions and editor typography whenever the runtime changes
- `apps/workbench/src/terminal/terminal-host.ts`
  - binds to the same runtime through `bindThemeRuntime(...)`
  - updates xterm colors, ANSI palette, font family, font size, line height, and host container styling on theme changes
- `packages/icons/icon-theme-service.ts`
  - binds icon resolution to `ThemeRuntime`
  - invalidates icon/file caches when the theme revision changes
  - exposes cache telemetry and icon-token snapshots for Angular and future renderer consumers
- `apps/workbench/angular/src/app/services/angular-theme-host.service.ts`
  - owns the Angular bootstrap `ThemeRuntime`
  - applies shared runtime CSS variables, theme metadata, and icon sizing tokens onto `document.documentElement`
- `apps/workbench/angular/src/app/services/angular-icon-theme-host.service.ts`
  - binds the shared icon theme service to the Angular runtime
  - exposes icon theme kind, cache stats, and icon token snapshots to Angular shell components
- `apps/workbench/src/boot/workbench-bootstrap-runtime.ts`
  - mounts the default terminal with runtime-derived colors and sizing variables
  - wires the terminal host to the shared runtime during renderer startup
- `apps/workbench/src/shell/workbench-shell-state.ts`
  - seeds shell CSS tokens from the shared default design-token catalog instead of maintaining its own hardcoded subset

## Follow-on Work
- `IDE-021` builds appearance commands and UX on top of the shared runtime.
- `IDE-109` can now consume a stable theming foundation for theme-pack work.

## Verification
- `yarn nx run platform:test --runInBand`
- `yarn nx run workbench:test --runInBand`
- `yarn nx run-many --target=test --all --runInBand`
