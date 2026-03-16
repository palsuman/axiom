# Nexus Execution Rules

These rules apply to every execution in this repository.

1. Build for professional production quality from the start.
   Every delivered increment must be secure, tested, documented, and maintainable. Scope may be phased; quality is not.

2. Keep the codebase clean and modular.
   New code must live in a clear domain/module folder. Do not place feature files ad hoc at package roots when a domain directory is more appropriate.

3. Keep code and documentation in sync.
   Any behavior, contract, path, or architecture change must update the corresponding docs in the same execution.

4. Require tests before and after meaningful changes.
   Do not layer new work on top of failing tests. Run the relevant tests for the change and keep the full suite green for structural work.

5. Prefer explicit contracts over feature-local shortcuts.
   Shared concerns such as theming, settings, IPC, persistence, and extension surfaces must use typed schemas/services instead of duplicated per-feature logic.

6. Preserve architectural consistency.
   Follow the domain structure documented in `docs/governance/engineering-standards.md` and `docs/ARCHITECTURE.md`. If a structure gap is found, fix the structure instead of copying the inconsistency.

7. Ship documentation as a first-class artifact.
   Every subsystem must have an authoritative doc describing purpose, ownership boundary, public contract, and verification path.

8. Follow current Angular best practices for all Angular migration work.
   For `apps/workbench/angular`, use standalone APIs, zoneless change detection, `OnPush`-compatible component design, signals for local reactive state, and one primary responsibility per file. Avoid reintroducing `NgModule`-first patterns, `zone.js`, or ad hoc file placement.

9. Keep Angular app structure deliberate and non-ad hoc.
   Under `src/app`, place Angular code in purpose-specific folders such as `components`, `services`, `models`, `types`, `providers`, `directives`, and `pipes`. Prefer a dedicated component folder when a component has companion template/style/spec files.

10. Treat Angular guidance as an externally versioned contract.
    When Angular architectural choices or best practices are in doubt, verify them against official Angular documentation first, especially the zoneless guide, `provideZonelessChangeDetection` API docs, and the Angular style guide.
