# ADR-11 Renderer Framework Decision - Migrate to Angular

## Status
Accepted

## Context
The current renderer implementation in `apps/workbench` does not match the project planning and architecture artifacts.

Observed repository state:
- The current renderer is implemented as TypeScript services/classes plus direct DOM rendering.
- The workbench build uses `tsc` and the Electron preload mounts the current DOM renderer.
- The root `package.json` does not contain Angular dependencies.
- `apps/workbench/project.json` does not define an Angular build/test pipeline.

Planning and documentation state before this ADR:
- `tasks/TASKS.md`, `tasks/TRACKER.md`, and multiple architecture/product docs described the renderer as if Angular were already the active implementation.
- Renderer feature tasks were still sequenced as normal feature delivery even though the target framework was not actually installed or running.
- This mismatch created execution risk: feature work could continue to land on the direct DOM renderer while the plan assumed an Angular workbench.

This is a structural delivery problem, not a cosmetic wording issue:
- the repository needs a single authoritative renderer direction
- the migration must be prioritized before further renderer feature expansion
- completion criteria must define when paused renderer work can resume

Relevant tasks:
- `IDE-206` ADR: Renderer framework decision — migrate to Angular
- `IDE-207` Renderer architecture/docs/tracker/package alignment
- `IDE-208` Angular dependency and build bootstrap
- `IDE-209` Angular shell host becomes primary renderer path
- `IDE-210` Legacy DOM renderer removal or formal deprecation
- `IDE-216` Renderer migration signoff and paused-work reopen

## Decision
Nexus will adopt Angular as the target renderer/workbench framework and will treat the current TypeScript + direct DOM renderer as an interim implementation.

The project will immediately prioritize renderer migration before additional renderer feature implementation.

Execution rules established by this ADR:
- Angular is the canonical target renderer framework for the workbench.
- The current direct DOM renderer is explicitly recognized as the current state, not the intended long-term renderer architecture.
- Renderer work is restricted to:
  - Angular migration tasks
  - migration blocker fixes
  - documentation, tracker, and package/dependency alignment
- Non-migration renderer feature work remains on hold until migration signoff is complete.

Migration ordering is defined as:
1. `P0` Angular migration and planning/docs alignment
2. `P1` Theme and icon foundations
3. `P2` Angular shell and layout system
4. `P3` Core panels and workflows
5. `P4` Resume paused renderer feature work after migration signoff

The Angular migration is not considered complete until all of the following are true:
- Angular shell is the primary renderer path.
- The legacy DOM renderer is removed.
- Documentation, tracker artifacts, and package dependencies are aligned with the Angular target.
- Theme and icon systems are established and adopted by the Angular shell.
- The shell supports:
  - a right activity bar
  - a right utility panel
  - an AI chat surface
  - run/debug/test architecture
- Build, lint, and test pass.

Design direction constraints for the Angular target shell:
- The overall shell direction should be clean and strongly influenced by VS Code for workbench ergonomics.
- Run/debug/test configuration and execution should provide an IntelliJ-like workflow architecture.
- Right-side activity/panel surfaces should support notifications and secondary tools in an IntelliJ-like layout.
- AI chat should be a first-class shell surface integrated into the right-side architecture.

## Consequences
- Positive:
  - The repository now has a single authoritative renderer direction.
  - Migration work is sequenced ahead of incompatible renderer feature expansion.
  - Planning artifacts can no longer imply Angular is already live when it is not.
  - Resume criteria for paused renderer tasks are explicit and reviewable.

- Trade-offs:
  - Renderer feature work will slow down in the short term because migration takes precedence.
  - Existing renderer work completed on the direct DOM path may require Angular parity or reimplementation.
  - Teams must maintain clear distinction between current-state documentation and target-state architecture until migration is complete.

- Follow-up actions:
  - Complete `IDE-207` to align architecture, tracker, task, and dependency docs around this decision.
  - Complete `IDE-208` through `IDE-210` to make Angular the primary renderer path and retire the legacy DOM renderer.
  - Keep all paused renderer tasks blocked until the migration resume gate is satisfied.
