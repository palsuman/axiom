# Engineering Standards

`IDE-200` makes these standards explicit for the Nexus repo. They are mandatory for all future work.

## Non-negotiables

1. Production-grade quality from day one
   Sequencing may defer breadth, but no implementation is allowed to be knowingly "temporary MVP quality." Security, validation, tests, and maintainability are required immediately.

2. Domain-first structure
   Shared packages must group code by domain, not by historical accident.

3. Docs and code move together
   If code behavior, public APIs, file paths, or architecture change, the corresponding docs must be updated in the same execution.

4. Tests protect every meaningful change
   Structural refactors require a full test pass. Feature work requires at least targeted tests and must not start from a failing baseline.

5. One source of truth per cross-cutting concern
   Theming, settings, IPC contracts, persistence, security policies, and extension APIs must each have a canonical shared contract.

## Package Organization Rules

Use domain directories inside shared packages. Avoid leaving standalone feature modules at the package root unless they are package-wide entrypoints or config files.

Current `packages/platform` domains:

- `config/`: environment and runtime configuration contracts
- `explorer/`: explorer/tree state helpers
- `filesystem/`: filesystem mutation and safety primitives
- `scm/git/`: git repository services and types
- `settings/`: settings schema and resolution
- `theming/`: theme manifests, validation, and token resolution
- `windowing/`: persisted window state and window-level models
- `workspace/`: workspace descriptors, history, backups, watchers, and storage layout

Allowed root files in shared packages should be limited to package metadata and tooling such as `package.json`, `project.json`, `jest.config.*`, `tsconfig.*`, or an intentional package entrypoint.

## Execution Checklist

Before implementation:

- Confirm the existing test baseline is green if the task depends on it.
- Identify the owning domain/module before creating files.
- Identify the authoritative docs that must be updated.

During implementation:

- Keep imports and file paths consistent with the domain layout.
- Add or update tests with the code change.
- Avoid TODO placeholders, compatibility hacks, or duplicate contracts unless tracked and justified.

After implementation:

- Run relevant verification commands.
- Update task planning/tracking artifacts when scope or standards change.
- Verify docs reflect the final behavior and file locations.
