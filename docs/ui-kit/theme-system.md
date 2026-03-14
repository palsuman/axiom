# Theme System (IDE-198)

## Scope
- Shared theme manifests and resolution logic live in `packages/platform/theming/theme-registry.ts`.
- The registry defines the canonical semantic color slots for shell, editor, status bar, and terminal surfaces.
- Built-in themes ship as registry manifests: `Nexus Dark`, `Nexus Light`, and `Nexus High Contrast`.

## Manifest Contract
- Theme manifests declare `id`, `label`, `kind`, optional `extends`, optional `uiBaseTheme`, and a partial `colors` map.
- `kind` controls the default fallback palette (`light`, `dark`, `high-contrast`) when a manifest does not extend another theme.
- `extends` layers a child theme on top of an already-registered parent theme.
- Unknown color slots, malformed colors, duplicate IDs, and missing parents are rejected at registration time with actionable errors.

## Resolution Rules
- The registry resolves a theme into a full semantic token set, not just the overrides declared in the manifest.
- Resolution order is deterministic:
  1. Theme-kind fallback palette
  2. Parent theme, if `extends` is set
  3. Child theme overrides
- Resolved themes also expose CSS variables so shell/runtime consumers can apply them without maintaining separate mapping tables.

## Current Consumers
- `apps/workbench/src/settings/settings-service.ts` uses the registry to populate the `workbench.colorTheme` enum and apply resolved CSS tokens to `WorkbenchShell`.
- Future tasks build on the same contract:
  - `IDE-199` for runtime token propagation and scoped overrides
  - `IDE-021` for appearance commands and UX
  - `IDE-192` for icon-theme synchronization
  - `IDE-109` for theme pack import/export

## Verification
- `yarn nx run platform:test`
- `yarn nx run workbench:test`
- `yarn nx run-many --target=test --all --runInBand`
