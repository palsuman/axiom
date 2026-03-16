# Icon Module Overview

## Purpose
The icon module provides a single source of truth for workbench, explorer, and extension-provided icons. It guarantees:

- Strongly typed definitions for codicons, file/folder icons, theme-aware glyphs, and future SVG/custom sources.
- A central registry with duplicate protection, alias handling, caching, fallback behavior, and telemetry hooks.
- Deterministic resolution so UI components only deal with `IconResolveResult` objects instead of bespoke CSS logic.
- A shipped asset pack consisting of the official `@vscode/codicons` font/CSS plus curated Nexus file/folder icon classes for the Angular workbench.

## Key APIs

### `IconDefinition`
Defines icon metadata, variants per theme, aliases, and tags. Variants describe CSS classes plus optional color or SVG payload metadata.

### `IconRegistry`
- `registerIcon(definition, options)` registers a definition and enforces duplicate detection.
- `registerAlias(aliasId, targetId)` lets features expose ergonomic aliases without duplicating assets.
- `resolveIcon(id, theme)` performs alias resolution, applies fallbacks, and returns cached results for high-volume surfaces like explorer trees.
- Telemetry callbacks (`onRegister`, `onDuplicate`, `onResolve`, `onResolveMiss`) allow instrumentation without coupling to specific logging systems.

### `IconThemeService`
- Binds icon resolution to the shared `ThemeRuntime`, mapping workbench themes to icon variants (`light`, `dark`, `highContrast`).
- Owns renderer-facing icon/file cache lifecycles so cache entries are invalidated automatically when the active workbench theme changes.
- Exposes cache telemetry hooks for icon hits, misses, invalidations, and theme-change events without coupling the icon package to the desktop telemetry persistence layer.
- Provides a single snapshot containing the active theme id, icon tokens, revision, and cache stats so Angular shell consumers can render icon-aware UI without duplicating theme logic.

### Built-in Asset Pack
- `packages/icons/builtin-icon-pack.ts` registers the built-in codicon entries plus curated file/folder icon definitions that match the built-in resolver mappings.
- `apps/workbench/angular/src/styles/icons.css` imports the official `@vscode/codicons/dist/codicon.css` asset bundle and ships the Nexus file/folder icon classes used by the built-in pack.
- The built-in file/folder pack intentionally provides a stable curated baseline for Angular shell work; future theme packs can override definitions without changing consumer contracts.

### `FileIconResolver`
- Consumes the `FileIconTheme` dataset (`file-icon-mappings.ts`) and resolves folder/file icons for explorer, tabs, breadcrumbs, and search results.
- Evaluation order: folder-specific overrides → root folder defaults → exact filename → compound extension → extension → language id → default file icon.
- Built-in mappings cover TypeScript/JavaScript/JSON/HTML/CSS/Markdown/YAML/Python/Go/Rust/C/C++/Docker/Git artifacts plus common folders (`src`, `dist`, `node_modules`, etc.).
- Consumers only provide `{ fileName, isFolder?, isFolderExpanded?, isRootFolder?, languageId? }` and receive `{ iconId, reason }`, making telemetry and debugging straightforward.

### Path Exports
Import via `@nexus/icons`:
```ts
import { IconRegistry, FileIconResolver, BUILTIN_FILE_ICON_THEME } from '@nexus/icons';
```

## Fallback + Accessibility Strategy
- A default codicon-based fallback (`icon.fallback`) is always registered so unresolved IDs never break rendering.
- Consumers must supply aria-labels; the resolved result exposes `definition.label` to seed accessible descriptions or i18n keys.
- Theme switching should bind through `IconThemeService`, which consumes the shared `ThemeRuntime` and clears icon/file caches when the workbench theme changes.

## Angular Migration Integration
- `apps/workbench/angular/src/app/services/angular-theme-host.service.ts` owns the shared `ThemeRuntime` for the Angular shell bootstrap.
- `apps/workbench/angular/src/app/services/angular-icon-theme-host.service.ts` binds `IconThemeService` to that runtime and exposes icon theme/cache snapshots to Angular components.
- The Angular shell bootstrap now consumes icon theme state from the shared runtime instead of hard-coded light/dark icon assumptions.
- The Angular global style entry imports the built-in codicon/file-icon asset CSS so future Angular icon components can render from the shared registry without additional asset wiring.

## Testing Guidance
Use Jest to assert caching, fallback, and alias behavior. Include regression tests when adding new icon kinds to avoid breaking explorer or status bar decorations.
