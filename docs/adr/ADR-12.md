# ADR-12 Legacy DOM Renderer Retirement

## Status
Accepted

## Context
`IDE-209` made the Angular workbench shell the primary Electron renderer path. That removed the architectural ambiguity about the target framework, but it still left unnecessary fallback code and documentation around the historical TypeScript + direct DOM renderer.

Keeping the DOM renderer around still carried two practical risks:
- the DOM renderer could continue to behave like an unofficial second implementation path
- developers could keep landing renderer changes on the retired stack instead of the Angular shell

The repo needs a clean removal path that makes Angular canonical without retaining a second renderer runtime.

Relevant tasks:
- `IDE-209` Angular shell host becomes primary renderer path
- `IDE-210` Legacy DOM renderer removal or formal deprecation
- `IDE-211` Angular shell composition and layout parity
- `IDE-216` Renderer migration signoff and paused-work reopen

## Decision
The historical TypeScript + direct DOM renderer has now been removed from the Electron preload path.

Effective rules:
- Angular is the only canonical renderer path for normal development, validation, and feature delivery.
- Electron must launch the Angular renderer by default.
- The DOM renderer must not remain in the preload runtime as a fallback or recovery path.
- `desktop-shell:serve` must build and launch the Angular path only.

Ownership and sunset policy:
- Renderer migration owners are responsible for keeping the DOM renderer removed and preventing reintroduction through preload or Electron startup paths.
- No paused renderer feature task may use a direct DOM renderer as its implementation target.

## Completion Criteria
This retirement decision is considered implemented only when all of the following are true:
- preload behavior documents and enforces Angular as the default path
- the DOM renderer is absent from the Electron runtime path
- architecture, build, tracker, and migration docs describe the same deprecation policy
- verification covers Angular startup and failure-mode handling without DOM fallback

## Consequences
- Positive:
  - There is no longer any ambiguity about the canonical renderer path.
  - The preload/runtime path is smaller and easier to reason about.
  - Docs, build targets, and preload behavior now share the same operational contract.

- Trade-offs:
  - Angular renderer startup failures now surface as hard failures instead of falling back.
  - Historical TypeScript workbench modules may still exist in the repo until later migration tasks replace or retire them.

- Follow-up actions:
  - Complete `IDE-211` through `IDE-215` on the Angular path only.
  - Continue removing or absorbing historical renderer-only TypeScript modules as Angular parity tasks complete.
