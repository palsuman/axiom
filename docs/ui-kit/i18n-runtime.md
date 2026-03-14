# i18n Runtime + Locale Switcher

`IDE-181` adds the MVP localization runtime for the workbench and wires the existing `workbench.locale` setting into live UI behavior.

## Runtime architecture

- [apps/workbench/src/i18n-service.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/apps/workbench/src/i18n-service.ts) provides:
  - translation bundle registration
  - locale change listeners
  - fallback resolution
  - `{placeholder}` interpolation
  - locale display names for the workbench switcher
- [apps/workbench/src/settings-service.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/apps/workbench/src/settings-service.ts) now drives the runtime locale from the persisted `workbench.locale` user setting.
- [apps/workbench/src/workbench-layout-store.ts](/Users/sumanpal/Developer/Projects/ide-project/nexus/apps/workbench/src/workbench-layout-store.ts) passes the shared i18n runtime into the bootstrapped shell so persisted layout state and runtime locale stay in sync.

## Supported locales

The MVP runtime ships with:

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

`main.ts` registers:

- `nexus.locale.switch` for explicit locale changes
- `nexus.locale.cycle` for cycling between supported locales
- a quick-open provider that surfaces supported languages

Changing the locale updates the i18n runtime immediately and persists the new value back through the settings service.

## Extending translations

Add a new locale by:

1. Extending `WORKBENCH_SUPPORTED_LOCALES`.
2. Adding a `TranslationBundle` entry to `WORKBENCH_I18N_BUNDLES`.
3. Providing a `locale.name.<locale>` translation key so the switcher renders a human-friendly label.
4. Covering the new locale in unit tests when new translated surfaces are added.

## Verification

- `yarn nx run workbench:test`
- `./node_modules/.bin/eslint apps/workbench/src/i18n-service.ts apps/workbench/src/main.ts apps/workbench/src/settings-service.ts apps/workbench/src/command-palette.ts apps/workbench/src/workbench-shell.ts apps/workbench/src/notification-center.ts apps/workbench/src/command-registry.ts apps/workbench/src/workbench-layout-store.ts`
