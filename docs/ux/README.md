# UX Foundations

`IDE-114` establishes the baseline accessibility contract for the current Nexus workbench shell.

## Scope

The current shell accessibility contract provides:

- labeled landmarks for the activity bar, sidebars, editor, panel, and status bar
- a skip link that moves keyboard users directly to the editor surface
- accessible names on icon-only controls and status bar actions
- roving keyboard navigation for activity buttons, sidebar view selectors, panel selectors, and editor tabs
- focus restoration after shell rerenders so keyboard users do not lose context
- a polite live-region summary that announces high-level shell state changes

The pure accessibility helpers live in [apps/workbench/src/shell/workbench-accessibility.ts](/Users/sumanpal/Developer/Projects/nexus/apps/workbench/src/shell/workbench-accessibility.ts). This file is the canonical place for keyboard-roving logic, landmark labels, and screen-reader summary generation.

## Keyboard Contract

- `Tab` reaches the skip link first, then the shell's interactive controls.
- `Enter` on the skip link focuses the editor region.
- `ArrowUp` and `ArrowDown` move through the vertical activity bar.
- `ArrowLeft` and `ArrowRight` move through horizontal selector groups such as sidebar views, editor tabs, and panel views.
- `Home` and `End` jump to the start and end of the active roving group.

## Localization

Accessibility labels are localized through [apps/workbench/src/i18n/i18n-service.ts](/Users/sumanpal/Developer/Projects/nexus/apps/workbench/src/i18n/i18n-service.ts). New shell surfaces must add translation keys for accessible labels at the same time as the visible UI change.

## Verification

- `./node_modules/.bin/jest --config apps/workbench/jest.config.cjs --runInBand apps/workbench/src/shell/workbench-shell.spec.ts apps/workbench/src/shell/workbench-layout-store.spec.ts apps/workbench/src/shell/workbench-accessibility.spec.ts`
- `./node_modules/.bin/eslint apps/workbench/src/shell/workbench-accessibility.ts apps/workbench/src/shell/workbench-accessibility.spec.ts apps/workbench/src/i18n/i18n-service.ts`

## Follow-on Work

- When Playwright and Axe coverage land, the shell accessibility assertions here should be mirrored in browser-level smoke tests.
- New shell regions should reuse the roving-toolbar helper instead of adding bespoke keyboard navigation.
