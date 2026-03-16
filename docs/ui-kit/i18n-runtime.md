# i18n Runtime + Locale Switcher

`IDE-181` adds the localization runtime for the workbench and wires the existing `workbench.locale` setting into live UI behavior.

## Runtime architecture

- [apps/workbench/src/i18n/i18n-service.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/apps/workbench/src/i18n/i18n-service.ts) provides:
  - translation bundle registration
  - locale change listeners
  - fallback resolution
  - `{placeholder}` interpolation
  - locale display names for the workbench switcher
- [apps/workbench/src/settings/settings-service.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/apps/workbench/src/settings/settings-service.ts) now drives the runtime locale from the persisted `workbench.locale` user setting.
- [apps/workbench/src/shell/workbench-layout-store.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/apps/workbench/src/shell/workbench-layout-store.ts) passes the shared i18n runtime into the bootstrapped shell so persisted layout state and runtime locale stay in sync.
- [apps/workbench/src/boot/workbench-bootstrap-contributions.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/apps/workbench/src/boot/workbench-bootstrap-contributions.ts) owns locale-aware quick-open providers and status bar bindings, keeping i18n-facing shell contributions out of the root bootstrap module.
- [apps/workbench/src/boot/workbench-bootstrap-commands.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/apps/workbench/src/boot/workbench-bootstrap-commands.ts) registers locale commands separately from service composition and runtime startup.
- [apps/workbench/angular/src/app/services/angular-workbench-layout.service.ts](/Users/sumanpal/Developer/Projects/nexus/apps/workbench/angular/src/app/services/angular-workbench-layout.service.ts) now consumes the shared i18n runtime for Angular shell titles, status items, locale cycling, and locale-change notifications.

## Supported locales

The runtime ships with:

- `en-US`
- `fr-FR`
- `es-ES`

`NEXUS_LOCALE` still seeds the initial renderer locale, but the user setting takes over once settings initialization completes.

## Workbench behavior

The runtime currently localizes:

- command palette command titles and localized command details
- notification labels through `NotificationCenter`
- notification status text and tooltips in the status bar
- a new locale status item in the status bar
- locale switch notifications
- quick-open entries for workspace open and language switching

`apps/workbench/src/boot/bootstrap-workbench.ts` now delegates to focused boot modules:

- `workbench-bootstrap-contributions.ts` for locale switcher quick-open entries and locale/status bar bindings
- `workbench-bootstrap-commands.ts` for `nexus.locale.switch` and `nexus.locale.cycle`
- `workbench-bootstrap-runtime.ts` for runtime startup after commands and providers are wired

The composed bootstrap registers:

- `nexus.locale.switch` for explicit locale changes
- `nexus.locale.cycle` for cycling between supported locales
- a quick-open provider that surfaces supported languages

Changing the locale updates the i18n runtime immediately and persists the new value back through the settings service.
The Angular shell now uses the same runtime hooks for localized activity/sidebar/panel labels and status bar locale feedback while broader settings persistence parity continues under the remaining migration tasks.

## Extending translations

Add a new locale by:

1. Extending `WORKBENCH_SUPPORTED_LOCALES`.
2. Adding a `TranslationBundle` entry to `WORKBENCH_I18N_BUNDLES`.
3. Providing a `locale.name.<locale>` translation key so the switcher renders a human-friendly label.
4. Covering the new locale in unit tests when new translated surfaces are added.

## Verification

- `yarn nx run workbench:test`
- `./node_modules/.bin/eslint apps/workbench/src/i18n/i18n-service.ts apps/workbench/src/boot/bootstrap-workbench.ts apps/workbench/src/boot/workbench-bootstrap-contributions.ts apps/workbench/src/boot/workbench-bootstrap-commands.ts apps/workbench/src/settings/settings-service.ts apps/workbench/src/commands/command-palette.ts apps/workbench/src/shell/workbench-shell.ts apps/workbench/src/shell/workbench-shell-layout.ts apps/workbench/src/shell/notification-center.ts apps/workbench/src/commands/command-registry.ts apps/workbench/src/shell/workbench-layout-store.ts`
