# Architecture Decision Record (ADR) Process

IDE-007 establishes a lightweight governance workflow for capturing architectural choices.

## Principles
- **Every significant technical decision** (infrastructure, patterns, dependency changes, security posture, etc.) requires an ADR before implementation.
- ADR IDs are sequential (`ADR-0001`, `ADR-0002`, ...). Use kebab-case suffixes for clarity (e.g., `ADR-0011-electron-preload-security`).
- Status lifecycle: `Proposed` → `Accepted` → `Superseded` (optionally `Rejected`).
- ADRs live under `docs/adr/` and are committed with the code they describe.

## Creating a New ADR
1. Run the helper script:
   ```bash
   ./scripts/dev/new-adr.sh "Adopt Nx Workspace"
   ```
2. Edit the generated file (opens from template) to fill in the **Context**, **Decision**, and **Consequences** sections.
3. Link relevant tasks/issues and reference ADR ID in PR descriptions.
4. Update `Status` to `Accepted` once stakeholders approve; cross-link superseded ADRs when closing them.

## Template
See `docs/adr/TEMPLATE.md` for the canonical layout used by the generator script.

## Current High-Priority ADRs
- `ADR-11` records the renderer framework decision: the current renderer is TypeScript + direct DOM, and Angular is the committed migration target before further renderer feature expansion.
- `ADR-12` records the retirement of the legacy DOM renderer from the Electron runtime path after Angular became the canonical renderer.

## Verification
CI should enforce that files matching `docs/adr/ADR-*.md` exist for referenced ADR IDs (future enhancement). For now, reviewers ensure compliance before merging.
