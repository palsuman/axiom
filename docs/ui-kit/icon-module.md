# Icon Module Overview

## Purpose
The icon module provides a single source of truth for workbench, explorer, and extension-provided icons. It guarantees:

- Strongly typed definitions for codicons, file/folder icons, theme-aware glyphs, and future SVG/custom sources.
- A central registry with duplicate protection, alias handling, caching, fallback behavior, and telemetry hooks.
- Deterministic resolution so UI components only deal with `IconResolveResult` objects instead of bespoke CSS logic.

## Key APIs

### `IconDefinition`
Defines icon metadata, variants per theme, aliases, and tags. Variants describe CSS classes plus optional color or SVG payload metadata.

### `IconRegistry`
- `registerIcon(definition, options)` registers a definition and enforces duplicate detection.
- `registerAlias(aliasId, targetId)` lets features expose ergonomic aliases without duplicating assets.
- `resolveIcon(id, theme)` performs alias resolution, applies fallbacks, and returns cached results for high-volume surfaces like explorer trees.
- Telemetry callbacks (`onRegister`, `onDuplicate`, `onResolve`, `onResolveMiss`) allow instrumentation without coupling to specific logging systems.

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
- Theme switching should listen to the future IconThemeService (IDE-192) but the registry already stores resolved theme info.

## Testing Guidance
Use Jest to assert caching, fallback, and alias behavior. Include regression tests when adding new icon kinds to avoid breaking explorer or status bar decorations.
