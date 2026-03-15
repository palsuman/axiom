# Nexus Execution Tracker

Status legend: [ ] TODO, [-] In progress, [x] Done. Update each task line as you execute.

## Sprint S1

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [x] | IDE-001 | Monorepo bootstrap | Platform Foundations | infra | Foundation | P0 | Yes | None | Verification: Nx build + lint/test pipeline | Docs/API: docs/architecture + ADR updates for IDE-001 |
| [x] | IDE-002 | Package manager strategy | Platform Foundations | infra | Foundation | P0 | Yes | Blocked until IDE-001 | Verification: Nx build + lint/test pipeline | Docs/API: docs/architecture + ADR updates for IDE-002 |
| [x] | IDE-003 | Shared config packages | Platform Foundations | infra | Foundation | P0 | Yes | Blocked until IDE-001 | Verification: Nx build + lint/test pipeline | Docs/API: docs/architecture + ADR updates for IDE-003 |
| [x] | IDE-004 | Dev environment automation | Platform Foundations | infra | Foundation | P1 | No | Blocked until IDE-001 | Verification: Nx build + lint/test pipeline | Docs/API: docs/architecture + ADR updates for IDE-004 |
| [x] | IDE-005 | Build + bundler pipeline | Platform Foundations | infra | Foundation | P0 | Yes | Blocked until IDE-001 | Verification: Nx build + lint/test pipeline | Docs/API: docs/architecture + ADR updates for IDE-005 |
| [x] | IDE-006 | Quality gate baseline | Platform Foundations | infra | Foundation | P0 | Yes | Blocked until IDE-003 | Verification: Nx build + lint/test pipeline | Docs/API: docs/architecture + ADR updates for IDE-006 |
| [x] | IDE-007 | Architecture decision records | Platform Foundations | infra | Foundation | P1 | No | Blocked until IDE-001 | Verification: Nx build + lint/test pipeline | Docs/API: docs/architecture + ADR updates for IDE-007 |
| [x] | IDE-008 | Secrets & environment policy | Platform Foundations | infra | Foundation | P0 | Yes | Blocked until IDE-001 | Verification: Nx build + lint/test pipeline | Docs/API: docs/architecture + ADR updates for IDE-008 |
| [x] | IDE-145 | Distributed cache & affected graph | Platform Foundations | infra | Foundation | P0 | Yes | Blocked until IDE-005, IDE-006 | Verification: Nx build + lint/test pipeline | Docs/API: docs/architecture + ADR updates for IDE-145 |
| [ ] | IDE-146 | Devcontainer & environment parity | Platform Foundations | infra | Expansion | P1 | No | Blocked until IDE-004 | Verification: Nx build + lint/test pipeline | Docs/API: docs/architecture + ADR updates for IDE-146 |
| [x] | IDE-180 | Env var + persistence contract | Platform Foundations | infra | Foundation | P0 | Yes | Blocked until IDE-008 | Verification: Nx build + lint/test pipeline | Docs/API: docs/architecture + ADR updates for IDE-180 |
| [x] | IDE-200 | Engineering execution standards | Platform Foundations | infra | Foundation | P0 | Yes | Blocked until IDE-007 | Verification: Full test pass + doc review | Docs/API: AGENTS.md + docs/governance/engineering-standards.md |
| [x] | IDE-201 | Platform package domain normalization | Platform Foundations | infra | Foundation | P0 | Yes | Blocked until IDE-001, IDE-003 | Verification: Full test pass + import/path audit | Docs/API: docs/ARCHITECTURE.md + docs/governance/engineering-standards.md |

## Sprint S2

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [x] | IDE-009 | Electron main bootstrap | Electron Shell | platform | Foundation | P0 | Yes | Blocked until IDE-005 | Verification: Electron smoke tests + crash harness | Docs/API: docs/architecture/electron for IDE-009 |
| [x] | IDE-010 | Secure preload bridge | Electron Shell | platform | Foundation | P0 | Yes | Blocked until IDE-009, IDE-008 | Verification: Electron smoke tests + crash harness | Docs/API: docs/architecture/electron for IDE-010 |
| [x] | IDE-011 | Multi-window/session mgr | Electron Shell | platform | Expansion | P1 | No | Blocked until IDE-009 | Verification: Electron smoke tests + crash harness | Docs/API: docs/architecture/electron for IDE-011 |
| [x] | IDE-012 | Native menus & keymaps | Electron Shell | platform | Foundation | P1 | No | Blocked until IDE-009 | Verification: Electron smoke tests + crash harness | Docs/API: docs/architecture/electron for IDE-012 |
| [x] | IDE-013 | File/URL associations | Electron Shell | platform | Expansion | P2 | No | Blocked until IDE-009 | Verification: Electron smoke tests + crash harness | Docs/API: docs/architecture/electron for IDE-013 |
| [x] | IDE-014 | Auto-update channel scaffolding | Electron Shell | platform | Phase 8 (GA hardening) | P0 | Yes | Blocked until IDE-005, IDE-008 | Verification: Electron smoke tests + crash harness | Docs/API: docs/architecture/electron for IDE-014 |
| [x] | IDE-015 | Crash/uncaught handler | Electron Shell | platform | Foundation | P0 | Yes | Blocked until IDE-009 | Verification: Electron smoke tests + crash harness | Docs/API: docs/architecture/electron for IDE-015 |
| [x] | IDE-016 | Startup performance budget | Electron Shell | platform | Foundation | P0 | Yes | Blocked until IDE-005, IDE-117 | Verification: Electron smoke tests + crash harness | Docs/API: docs/architecture/electron for IDE-016 |
| [x] | IDE-203 | Desktop shell domain normalization | Electron Shell | platform | Foundation | P0 | Yes | Blocked until IDE-009, IDE-010, IDE-012, IDE-123, IDE-200 | Verification: desktop-shell test target + full repo tests | Docs/API: docs/ARCHITECTURE + docs/architecture/electron-shell for IDE-203 |

## Sprint S3

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [x] | IDE-017 | Workbench layout scaffolding | Angular Workbench Shell | frontend | Foundation | P0 | Yes | Blocked until IDE-005 | Verification: Angular unit tests + Playwright shell smoke | Docs/API: docs/ui-kit for IDE-017 |
| [x] | IDE-018 | Docking & split manager | Angular Workbench Shell | frontend | Foundation | P0 | Yes | Blocked until IDE-017 | Verification: Angular unit tests + Playwright shell smoke | Docs/API: docs/ui-kit for IDE-018 |
| [x] | IDE-019 | Status bar + notifications | Angular Workbench Shell | frontend | Foundation | P1 | No | Blocked until IDE-017 | Verification: Angular unit tests + Playwright shell smoke | Docs/API: docs/ui-kit for IDE-019 |
| [ ] | IDE-020 | Command palette + quick open shell | Angular Workbench Shell | frontend | Foundation | P0 | Yes | Blocked until IDE-017, IDE-076 | Verification: Angular unit tests + Playwright shell smoke | Docs/API: docs/ui-kit for IDE-020 |
| [ ] | IDE-021 | Theme + appearance service | Angular Workbench Shell | frontend | Foundation | P1 | No | Blocked until IDE-017, IDE-106, IDE-198, IDE-199 | Verification: Angular unit tests + Playwright shell smoke | Docs/API: docs/ui-kit for IDE-021 |
| [x] | IDE-204 | Workbench app domain normalization | Angular Workbench Shell | frontend | Foundation | P0 | Yes | Blocked until IDE-017, IDE-019, IDE-106, IDE-181, IDE-200 | Verification: workbench test target + full repo tests | Docs/API: docs/ARCHITECTURE + docs/ui-kit/i18n-runtime + docs/settings for IDE-204 |
| [x] | IDE-205 | Workbench shell composition decomposition | Angular Workbench Shell | frontend | Foundation | P0 | Yes | Blocked until IDE-017, IDE-019, IDE-106, IDE-181, IDE-200, IDE-204 | Verification: workbench test target + full repo tests | Docs/API: docs/ARCHITECTURE + docs/ui-kit/i18n-runtime + docs/settings + docs/extensions/git + docs/terminal for IDE-205 |
| [x] | IDE-198 | Theme registry + manifest schema | Angular Workbench Shell | frontend | Foundation | P0 | Yes | Blocked until IDE-017, IDE-106 | Verification: Theme registry unit tests + schema fixtures | Docs/API: docs/ui-kit/theme-system for IDE-198 |
| [x] | IDE-202 | Professional design token expansion | Angular Workbench Shell | frontend | Foundation | P0 | Yes | Blocked until IDE-198, IDE-199, IDE-200 | Verification: Theme registry/unit snapshots + editor/terminal integration tests | Docs/API: docs/ui-kit/theme-system for IDE-202 |
| [x] | IDE-199 | Theme runtime + token pipeline | Angular Workbench Shell | frontend | Foundation | P0 | Yes | Blocked until IDE-017, IDE-106, IDE-198 | Verification: Theme switching unit tests + Playwright shell smoke | Docs/API: docs/ui-kit/theme-system for IDE-199 |
| [ ] | IDE-022 | Welcome & onboarding surface | Angular Workbench Shell | frontend | Expansion | P2 | No | Blocked until IDE-017 | Verification: Angular unit tests + Playwright shell smoke | Docs/API: docs/ui-kit for IDE-022 |
| [ ] | IDE-023 | Workspace-aware breadcrumbs | Angular Workbench Shell | frontend | Foundation | P1 | No | Blocked until IDE-017, IDE-041 | Verification: Angular unit tests + Playwright shell smoke | Docs/API: docs/ui-kit for IDE-023 |
| [ ] | IDE-024 | Context menu + dialog framework | Angular Workbench Shell | frontend | Foundation | P1 | No | Blocked until IDE-017 | Verification: Angular unit tests + Playwright shell smoke | Docs/API: docs/ui-kit for IDE-024 |
| [ ] | IDE-025 | Busy/progress overlays | Angular Workbench Shell | frontend | Foundation | P1 | No | Blocked until IDE-017 | Verification: Angular unit tests + Playwright shell smoke | Docs/API: docs/ui-kit for IDE-025 |
| [ ] | IDE-147 | Panel host framework | Angular Workbench Shell | frontend | Foundation | P0 | Yes | Blocked until IDE-017, IDE-020 | Verification: Angular unit tests + Playwright shell smoke | Docs/API: docs/ui-kit for IDE-147 |
| [ ] | IDE-148 | Problems & output views | Angular Workbench Shell | frontend | Foundation | P0 | Yes | Blocked until IDE-147, IDE-044 | Verification: Angular unit tests + Playwright shell smoke | Docs/API: docs/ui-kit for IDE-148 |
| [x] | IDE-181 | i18n runtime + locale switcher | Angular Workbench Shell | frontend | Foundation | P0 | Yes | Blocked until IDE-017, IDE-106 | Verification: Angular unit tests + Playwright shell smoke | Docs/API: docs/ui-kit for IDE-181 |
| [ ] | IDE-182 | Translation pipeline & tooling | Angular Workbench Shell | frontend | Foundation | P1 | No | Blocked until IDE-181, IDE-006 | Verification: Angular unit tests + Playwright shell smoke | Docs/API: docs/ui-kit for IDE-182 |
| [x] | IDE-190 | Icon domain model & registry | Icon System Platform | platform | Foundation | P0 | Yes | Blocked until IDE-017 | Verification: Icon registry unit tests + theme snapshot harness | Docs/API: docs/ui-kit/icon-module for IDE-190 |
| [ ] | IDE-192 | Icon theme service & caching telemetry | Icon System Platform | frontend | Foundation | P0 | Yes | Blocked until IDE-190, IDE-021, IDE-199, IDE-117 | Verification: Theme switching unit tests + telemetry assertions | Docs/API: docs/ui-kit/icon-module for IDE-192 |
| [ ] | IDE-193 | Angular icon component & directives | Icon System Platform | frontend | Foundation | P0 | Yes | Blocked until IDE-190, IDE-192, IDE-017 | Verification: Angular component tests + accessibility audit | Docs/API: docs/ui-kit/icon-module for IDE-193 |
| [ ] | IDE-194 | Built-in codicon & file icon packs | Icon System Platform | frontend | Foundation | P0 | Yes | Blocked until IDE-190, IDE-191, IDE-193 | Verification: Explorer/tab/icon snapshot tests + asset lint | Docs/API: docs/ui-kit/icon-module for IDE-194 |
| [ ] | IDE-197 | Icon module documentation & style contract | Icon System Platform | QA | Foundation | P1 | No | Blocked until IDE-194, IDE-143 | Verification: Doc lint + SME review | Docs/API: docs/ui-kit/icon-module for IDE-197 |

## Sprint S4

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [x] | IDE-026 | Workspace open service | Workspace / Project System | platform | Foundation | P0 | Yes | Blocked until IDE-009, IDE-020 | Verification: Workspace integration tests + telemetry validation | Docs/API: docs/workspace for IDE-026 |
| [x] | IDE-027 | Multi-root workspace model | Workspace / Project System | platform | Foundation | P0 | Yes | Blocked until IDE-026 | Verification: Workspace integration tests + telemetry validation | Docs/API: docs/workspace for IDE-027 |
| [x] | IDE-028 | Workspace state persistence | Workspace / Project System | platform | Foundation | P1 | No | Blocked until IDE-026, IDE-018 | Verification: Workspace integration tests + telemetry validation | Docs/API: docs/workspace for IDE-028 |
| [x] | IDE-029 | File watching + ignore rules | Workspace / Project System | platform | Foundation | P0 | Yes | Blocked until IDE-026 | Verification: Workspace integration tests + telemetry validation | Docs/API: docs/workspace for IDE-029 |
| [ ] | IDE-030 | Session restore safety | Workspace / Project System | platform | Foundation | P1 | No | Blocked until IDE-028 | Verification: Workspace integration tests + telemetry validation | Docs/API: docs/workspace for IDE-030 |
| [ ] | IDE-031 | Indexing orchestration | Workspace / Project System | platform | Foundation | P0 | Yes | Blocked until IDE-029, IDE-070 | Verification: Workspace integration tests + telemetry validation | Docs/API: docs/workspace for IDE-031 |
| [ ] | IDE-032 | Large workspace throttling | Workspace / Project System | platform | Expansion | P1 | No | Blocked until IDE-029 | Verification: Workspace integration tests + telemetry validation | Docs/API: docs/workspace for IDE-032 |
| [ ] | IDE-033 | Workspace metadata API | Workspace / Project System | platform | Expansion | P1 | No | Blocked until IDE-027, IDE-076 | Verification: Workspace integration tests + telemetry validation | Docs/API: docs/workspace for IDE-033 |
| [x] | IDE-149 | Workspace backup & hot exit | Workspace / Project System | platform | Foundation | P0 | Yes | Blocked until IDE-028, IDE-042 | Verification: Workspace integration tests + telemetry validation | Docs/API: docs/workspace for IDE-149 |
| [x] | IDE-191 | File icon resolver & mapping pipeline | Icon System Platform | frontend | Foundation | P0 | Yes | Blocked until IDE-190, IDE-029 | Verification: File icon resolver perf suite + explorer smoke tests | Docs/API: docs/ui-kit/icon-module for IDE-191 |
| [ ] | IDE-196 | Icon telemetry & regression harness | Icon System Platform | QA | Foundation | P1 | No | Blocked until IDE-192, IDE-134, IDE-117 | Verification: Icon regression CI pipeline + accessibility audit | Docs/API: docs/testing for IDE-196 |

## Sprint S5

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [x] | IDE-034 | Tree model + virtualization | File Explorer | frontend | Foundation | P0 | Yes | Blocked until IDE-029 | Verification: Playwright explorer flows + fs unit tests | Docs/API: docs/workspace/explorer for IDE-034 |
| [x] | IDE-035 | CRUD operations | File Explorer | frontend | Foundation | P0 | Yes | Blocked until IDE-034 | Verification: Playwright explorer flows + fs unit tests | Docs/API: docs/workspace/explorer for IDE-035 |
| [ ] | IDE-036 | Drag & drop + reveal | File Explorer | frontend | Foundation | P1 | No | Blocked until IDE-034 | Verification: Playwright explorer flows + fs unit tests | Docs/API: docs/workspace/explorer for IDE-036 |
| [ ] | IDE-037 | Decorations + Git badges | File Explorer | frontend | Foundation | P1 | No | Blocked until IDE-034, IDE-054 | Verification: Playwright explorer flows + fs unit tests | Docs/API: docs/workspace/explorer for IDE-037 |
| [ ] | IDE-038 | Filtering + compressed folders | File Explorer | frontend | Expansion | P2 | No | Blocked until IDE-034 | Verification: Playwright explorer flows + fs unit tests | Docs/API: docs/workspace/explorer for IDE-038 |
| [ ] | IDE-039 | Context menu extensibility | File Explorer | frontend | Expansion | P1 | No | Blocked until IDE-035, IDE-076 | Verification: Playwright explorer flows + fs unit tests | Docs/API: docs/workspace/explorer for IDE-039 |
| [ ] | IDE-040 | File diff preview | File Explorer | frontend | Expansion | P2 | No | Blocked until IDE-035, IDE-041, IDE-054 | Verification: Playwright explorer flows + fs unit tests | Docs/API: docs/workspace/explorer for IDE-040 |
| [ ] | IDE-150 | File system provider API | File Explorer | frontend | Expansion | P1 | No | Blocked until IDE-035, IDE-076, IDE-081 | Verification: Playwright explorer flows + fs unit tests | Docs/API: docs/workspace/explorer for IDE-150 |

## Sprint S6

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [x] | IDE-041 | Monaco integration | Editor Platform | frontend | Foundation | P0 | Yes | Blocked until IDE-017 | Verification: Editor unit tests + golden nav suite | Docs/API: docs/editor for IDE-041 |
| [x] | IDE-042 | Text model lifecycle | Editor Platform | frontend | Foundation | P0 | Yes | Blocked until IDE-041 | Verification: Editor unit tests + golden nav suite | Docs/API: docs/editor for IDE-042 |
| [x] | IDE-043 | Editor capability bridge | Editor Platform | frontend | Foundation | P1 | No | Blocked until IDE-041 | Verification: Editor unit tests + golden nav suite | Docs/API: docs/editor for IDE-043 |
| [ ] | IDE-044 | Inline diagnostics + markers | Editor Platform | frontend | Foundation | P0 | Yes | Blocked until IDE-041, IDE-070 | Verification: Editor unit tests + golden nav suite | Docs/API: docs/editor for IDE-044 |
| [ ] | IDE-045 | Navigation suite | Editor Platform | frontend | Foundation | P0 | Yes | Blocked until IDE-070, IDE-044 | Verification: Editor unit tests + golden nav suite | Docs/API: docs/editor for IDE-045 |
| [ ] | IDE-046 | Diff editor + review mode | Editor Platform | frontend | Expansion | P1 | No | Blocked until IDE-041, IDE-054 | Verification: Editor unit tests + golden nav suite | Docs/API: docs/editor for IDE-046 |
| [ ] | IDE-047 | Large file mode | Editor Platform | frontend | Expansion | P1 | No | Blocked until IDE-042 | Verification: Editor unit tests + golden nav suite | Docs/API: docs/editor for IDE-047 |
| [ ] | IDE-151 | Formatting + code style pipeline | Editor Platform | frontend | Foundation | P0 | Yes | Blocked until IDE-045, IDE-106 | Verification: Editor unit tests + golden nav suite | Docs/API: docs/editor for IDE-151 |
| [ ] | IDE-152 | CodeLens & inline hints | Editor Platform | frontend | Expansion | P1 | No | Blocked until IDE-041, IDE-079, IDE-071 | Verification: Editor unit tests + golden nav suite | Docs/API: docs/editor for IDE-152 |

## Sprint S7

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [ ] | IDE-049 | Quick file search | Search System | platform | Foundation | P0 | Yes | Blocked until IDE-031, IDE-020 | Verification: Search integration tests + perf benchmarks | Docs/API: docs/search for IDE-049 |
| [ ] | IDE-050 | Full text search | Search System | platform | Foundation | P0 | Yes | Blocked until IDE-031 | Verification: Search integration tests + perf benchmarks | Docs/API: docs/search for IDE-050 |
| [ ] | IDE-051 | Replace in files | Search System | platform | Foundation | P1 | No | Blocked until IDE-050 | Verification: Search integration tests + perf benchmarks | Docs/API: docs/search for IDE-051 |
| [ ] | IDE-052 | Indexed search strategy | Search System | platform | Expansion | P2 | No | Blocked until IDE-031 | Verification: Search integration tests + perf benchmarks | Docs/API: docs/search for IDE-052 |

## Sprint S8

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [ ] | IDE-048 | Editor extensibility hooks | Editor Platform | frontend | Vision | P2 | No | Blocked until IDE-041, IDE-076 | Verification: Editor unit tests + golden nav suite | Docs/API: docs/editor for IDE-048 |
| [x] | IDE-054 | Repo discovery + multi-root Git | SCM / Git | extension | Foundation | P0 | Yes | Blocked until IDE-026 | Verification: Git CLI parity tests + staged diff checks | Docs/API: docs/extensions/git for IDE-054 |
| [x] | IDE-055 | Status + staging view | SCM / Git | extension | Foundation | P0 | Yes | Blocked until IDE-054, IDE-041 | Verification: Git CLI parity tests + staged diff checks | Docs/API: docs/extensions/git for IDE-055 |
| [x] | IDE-056 | Commit composer + history | SCM / Git | extension | Foundation | P0 | Yes | Blocked until IDE-055 | Verification: Git CLI parity tests + staged diff checks | Docs/API: docs/extensions/git for IDE-056 |
| [ ] | IDE-057 | Branch + checkout | SCM / Git | extension | Foundation | P1 | No | Blocked until IDE-054 | Verification: Git CLI parity tests + staged diff checks | Docs/API: docs/extensions/git for IDE-057 |
| [ ] | IDE-058 | Merge conflict assistance | SCM / Git | extension | Expansion | P1 | No | Blocked until IDE-045, IDE-094 | Verification: Git CLI parity tests + staged diff checks | Docs/API: docs/extensions/git for IDE-058 |
| [ ] | IDE-059 | AI commit message generator | SCM / Git | extension | Expansion | P1 | No | Blocked until IDE-085, IDE-056 | Verification: Git CLI parity tests + staged diff checks | Docs/API: docs/extensions/git for IDE-059 |
| [ ] | IDE-154 | Blame & line history | SCM / Git | extension | Expansion | P1 | No | Blocked until IDE-041, IDE-054 | Verification: Git CLI parity tests + staged diff checks | Docs/API: docs/extensions/git for IDE-154 |
| [ ] | IDE-155 | Stash/cherry-pick workflow | SCM / Git | extension | Expansion | P2 | No | Blocked until IDE-056, IDE-057 | Verification: Git CLI parity tests + staged diff checks | Docs/API: docs/extensions/git for IDE-155 |

## Sprint S9

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [ ] | IDE-053 | Search extensibility | Search System | platform | Vision | P2 | No | Blocked until IDE-050, IDE-076 | Verification: Search integration tests + perf benchmarks | Docs/API: docs/search for IDE-053 |
| [x] | IDE-060 | Embedded terminal foundation | Terminal | platform | Foundation | P0 | Yes | Blocked until IDE-009, IDE-017 | Verification: Terminal PTY integration + snapshot tests | Docs/API: docs/terminal for IDE-060 |
| [ ] | IDE-061 | Multi/split terminal | Terminal | platform | Foundation | P1 | No | Blocked until IDE-060 | Verification: Terminal PTY integration + snapshot tests | Docs/API: docs/terminal for IDE-061 |
| [ ] | IDE-062 | Terminal search + links | Terminal | platform | Foundation | P1 | No | Blocked until IDE-060 | Verification: Terminal PTY integration + snapshot tests | Docs/API: docs/terminal for IDE-062 |
| [ ] | IDE-063 | AI command suggestions | Terminal | platform | Expansion | P2 | No | Blocked until IDE-085, IDE-060 | Verification: Terminal PTY integration + snapshot tests | Docs/API: docs/terminal for IDE-063 |
| [ ] | IDE-156 | Shell integration & env templates | Terminal | platform | Foundation | P1 | No | Blocked until IDE-060, IDE-106 | Verification: Terminal PTY integration + snapshot tests | Docs/API: docs/terminal for IDE-156 |

## Sprint S10

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [x] | IDE-064 | Run configuration schema | Run / Debug / Test | platform | Foundation | P0 | Yes | Blocked until IDE-026 | Verification: Debug adapter integration + test runner E2E | Docs/API: docs/run-debug-test for IDE-064 |
| [x] | IDE-065 | Debug adapter host | Run / Debug / Test | platform | Foundation | P0 | Yes | Blocked until IDE-064 | Verification: Debug adapter integration + test runner E2E | Docs/API: docs/run-debug-test for IDE-065 |
| [x] | IDE-066 | Breakpoint + watch UI | Run / Debug / Test | platform | Foundation | P0 | Yes | Blocked until IDE-065, IDE-041 | Verification: Debug adapter integration + test runner E2E | Docs/API: docs/run-debug-test for IDE-066 |
| [ ] | IDE-067 | Debug console + REPL | Run / Debug / Test | platform | Foundation | P1 | No | Blocked until IDE-065 | Verification: Debug adapter integration + test runner E2E | Docs/API: docs/run-debug-test for IDE-067 |
| [ ] | IDE-068 | Test explorer + runner | Run / Debug / Test | platform | Expansion | P1 | No | Blocked until IDE-031, IDE-070 | Verification: Debug adapter integration + test runner E2E | Docs/API: docs/run-debug-test for IDE-068 |
| [ ] | IDE-069 | Task runner integration | Run / Debug / Test | platform | Expansion | P2 | No | Blocked until IDE-064 | Verification: Debug adapter integration + test runner E2E | Docs/API: docs/run-debug-test for IDE-069 |
| [ ] | IDE-157 | Multi-runtime debug adapters | Run / Debug / Test | platform | Expansion | P1 | No | Blocked until IDE-065, IDE-076 | Verification: Debug adapter integration + test runner E2E | Docs/API: docs/run-debug-test for IDE-157 |
| [ ] | IDE-158 | Test coverage visualization | Run / Debug / Test | platform | Expansion | P1 | No | Blocked until IDE-068, IDE-041 | Verification: Debug adapter integration + test runner E2E | Docs/API: docs/run-debug-test for IDE-158 |

## Sprint S11

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [ ] | IDE-070 | LSP client architecture | Language Platform | platform | Foundation | P0 | Yes | Blocked until IDE-031 | Verification: LSP harness + diagnostics regression suite | Docs/API: docs/language for IDE-070 |
| [ ] | IDE-071 | Diagnostics pipeline | Language Platform | platform | Foundation | P0 | Yes | Blocked until IDE-070 | Verification: LSP harness + diagnostics regression suite | Docs/API: docs/language for IDE-071 |
| [ ] | IDE-072 | Semantic tokens + highlighting | Language Platform | platform | Foundation | P1 | No | Blocked until IDE-070 | Verification: LSP harness + diagnostics regression suite | Docs/API: docs/language for IDE-072 |
| [ ] | IDE-073 | Snippets + templates | Language Platform | platform | Foundation | P1 | No | Blocked until IDE-076 | Verification: LSP harness + diagnostics regression suite | Docs/API: docs/language for IDE-073 |
| [ ] | IDE-074 | Workspace symbols + outlines | Language Platform | platform | Foundation | P1 | No | Blocked until IDE-070, IDE-049 | Verification: LSP harness + diagnostics regression suite | Docs/API: docs/language for IDE-074 |
| [ ] | IDE-075 | Language pack SDK | Language Platform | platform | Expansion | P2 | No | Blocked until IDE-070, IDE-076 | Verification: LSP harness + diagnostics regression suite | Docs/API: docs/language for IDE-075 |
| [ ] | IDE-159 | Language server sandboxing | Language Platform | platform | Expansion | P1 | No | Blocked until IDE-070, IDE-117 | Verification: LSP harness + diagnostics regression suite | Docs/API: docs/language for IDE-159 |
| [ ] | IDE-160 | Offline grammar + fallback services | Language Platform | platform | Expansion | P2 | No | Blocked until IDE-072, IDE-074 | Verification: LSP harness + diagnostics regression suite | Docs/API: docs/language for IDE-160 |

## Sprint S12

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [ ] | IDE-076 | Extension manifest schema | Extension / Plugin Platform | extension | Foundation | P0 | Yes | Blocked until IDE-017, IDE-070 | Verification: Extension host integration + safe-mode tests | Docs/API: docs/extensions/platform for IDE-076 |
| [ ] | IDE-077 | Extension host process | Extension / Plugin Platform | extension | Foundation | P0 | Yes | Blocked until IDE-076, IDE-009 | Verification: Extension host integration + safe-mode tests | Docs/API: docs/extensions/platform for IDE-077 |
| [ ] | IDE-078 | Activation events + lifecycle | Extension / Plugin Platform | extension | Foundation | P0 | Yes | Blocked until IDE-077 | Verification: Extension host integration + safe-mode tests | Docs/API: docs/extensions/platform for IDE-078 |
| [ ] | IDE-079 | Contribution APIs | Extension / Plugin Platform | extension | Foundation | P0 | Yes | Blocked until IDE-077 | Verification: Extension host integration + safe-mode tests | Docs/API: docs/extensions/platform for IDE-079 |
| [ ] | IDE-195 | Extension icon contribution APIs | Icon System Platform | extension | Expansion | P1 | No | Blocked until IDE-079, IDE-194 | Verification: Extension host integration + safe-mode tests | Docs/API: docs/extensions/platform + docs/ui-kit/icon-module for IDE-195 |
| [ ] | IDE-080 | Extension marketplace ingest strategy | Extension / Plugin Platform | extension | Expansion | P1 | No | Blocked until IDE-076, IDE-117 | Verification: Extension host integration + safe-mode tests | Docs/API: docs/extensions/platform for IDE-080 |
| [ ] | IDE-081 | Permission + capability model | Extension / Plugin Platform | extension | Expansion | P0 | Yes | Blocked until IDE-077, IDE-123 | Verification: Extension host integration + safe-mode tests | Docs/API: docs/extensions/platform for IDE-081 |
| [ ] | IDE-082 | Extension diagnostics + tooling | Extension / Plugin Platform | extension | Expansion | P1 | No | Blocked until IDE-077, IDE-117 | Verification: Extension host integration + safe-mode tests | Docs/API: docs/extensions/platform for IDE-082 |
| [ ] | IDE-084 | Crash isolation + recovery UX | Extension / Plugin Platform | extension | Expansion | P0 | Yes | Blocked until IDE-077, IDE-117 | Verification: Extension host integration + safe-mode tests | Docs/API: docs/extensions/platform for IDE-084 |
| [ ] | IDE-161 | Extension marketplace UX | Extension / Plugin Platform | extension | Expansion | P1 | No | Blocked until IDE-080, IDE-019 | Verification: Extension host integration + safe-mode tests | Docs/API: docs/extensions/platform for IDE-161 |
| [ ] | IDE-162 | API version negotiation | Extension / Plugin Platform | extension | Expansion | P0 | Yes | Blocked until IDE-079, IDE-138 | Verification: Extension host integration + safe-mode tests | Docs/API: docs/extensions/platform for IDE-162 |
| [ ] | IDE-163 | Extension resource quotas | Extension / Plugin Platform | extension | Expansion | P1 | No | Blocked until IDE-077, IDE-117 | Verification: Extension host integration + safe-mode tests | Docs/API: docs/extensions/platform for IDE-163 |

## Sprint S13

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [x] | IDE-085 | llama.cpp controller service | AI Core Infrastructure (llama.cpp) | AI | Foundation | P0 | Yes | Blocked until IDE-005 | Verification: llama.cpp health checks + benchmark harness | Docs/API: docs/ai/core for IDE-085 |
| [ ] | IDE-086 | Model discovery & registry | AI Core Infrastructure (llama.cpp) | AI | Foundation | P0 | Yes | Blocked until IDE-085 | Verification: llama.cpp health checks + benchmark harness | Docs/API: docs/ai/core for IDE-086 |
| [ ] | IDE-087 | Prompt orchestration engine | AI Core Infrastructure (llama.cpp) | AI | Foundation | P0 | Yes | Blocked until IDE-085 | Verification: llama.cpp health checks + benchmark harness | Docs/API: docs/ai/core for IDE-087 |
| [ ] | IDE-088 | Streaming + cancellation | AI Core Infrastructure (llama.cpp) | AI | Foundation | P0 | Yes | Blocked until IDE-085 | Verification: llama.cpp health checks + benchmark harness | Docs/API: docs/ai/core for IDE-088 |
| [ ] | IDE-089 | Context gathering + RAG | AI Core Infrastructure (llama.cpp) | AI | Foundation | P0 | Yes | Blocked until IDE-031, IDE-087 | Verification: llama.cpp health checks + benchmark harness | Docs/API: docs/ai/core for IDE-089 |
| [ ] | IDE-090 | AI telemetry + benchmarking | AI Core Infrastructure (llama.cpp) | AI | Foundation | P1 | No | Blocked until IDE-085, IDE-117 | Verification: llama.cpp health checks + benchmark harness | Docs/API: docs/ai/core for IDE-090 |
| [ ] | IDE-091 | Safety + guardrails | AI Core Infrastructure (llama.cpp) | AI | Foundation | P0 | Yes | Blocked until IDE-085, IDE-123 | Verification: llama.cpp health checks + benchmark harness | Docs/API: docs/ai/core for IDE-091 |
| [ ] | IDE-092 | Model switching + settings UI | AI Core Infrastructure (llama.cpp) | AI | Expansion | P1 | No | Blocked until IDE-086, IDE-106 | Verification: llama.cpp health checks + benchmark harness | Docs/API: docs/ai/core for IDE-092 |
| [ ] | IDE-093 | Offline privacy mode | AI Core Infrastructure (llama.cpp) | AI | Expansion | P1 | No | Blocked until IDE-085, IDE-117 | Verification: llama.cpp health checks + benchmark harness | Docs/API: docs/ai/core for IDE-093 |
| [ ] | IDE-164 | Model packaging & compression | AI Core Infrastructure (llama.cpp) | AI | Expansion | P1 | No | Blocked until IDE-086 | Verification: llama.cpp health checks + benchmark harness | Docs/API: docs/ai/core for IDE-164 |
| [ ] | IDE-165 | AI resource scheduler | AI Core Infrastructure (llama.cpp) | AI | Expansion | P0 | Yes | Blocked until IDE-085, IDE-088 | Verification: llama.cpp health checks + benchmark harness | Docs/API: docs/ai/core for IDE-165 |
| [ ] | IDE-166 | Model license & compliance audit | AI Core Infrastructure (llama.cpp) | AI | Expansion | P1 | No | Blocked until IDE-086, IDE-117 | Verification: llama.cpp health checks + benchmark harness | Docs/API: docs/ai/core for IDE-166 |

## Sprint S14

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [ ] | IDE-083 | Local/private extension dev flow | Extension / Plugin Platform | extension | Vision | P1 | No | Blocked until IDE-079 | Verification: Extension host integration + safe-mode tests | Docs/API: docs/extensions/platform for IDE-083 |
| [ ] | IDE-094 | AI chat panel | AI IDE Features | AI | Foundation | P0 | Yes | Blocked until IDE-017, IDE-088, IDE-089 | Verification: AI UX E2E flows + approval logs review | Docs/API: docs/ai/features for IDE-094 |
| [ ] | IDE-095 | Inline code completion | AI IDE Features | AI | Foundation | P0 | Yes | Blocked until IDE-041, IDE-088 | Verification: AI UX E2E flows + approval logs review | Docs/API: docs/ai/features for IDE-095 |
| [ ] | IDE-096 | Inline edit/refactor | AI IDE Features | AI | Foundation | P0 | Yes | Blocked until IDE-041, IDE-094 | Verification: AI UX E2E flows + approval logs review | Docs/API: docs/ai/features for IDE-096 |
| [ ] | IDE-097 | Explain/fix diagnostics | AI IDE Features | AI | Foundation | P1 | No | Blocked until IDE-044, IDE-094 | Verification: AI UX E2E flows + approval logs review | Docs/API: docs/ai/features for IDE-097 |
| [ ] | IDE-098 | Generate tests/docstrings | AI IDE Features | AI | Expansion | P1 | No | Blocked until IDE-095, IDE-089 | Verification: AI UX E2E flows + approval logs review | Docs/API: docs/ai/features for IDE-098 |
| [ ] | IDE-101 | AI terminal command coach | AI IDE Features | AI | Expansion | P2 | No | Blocked until IDE-063 | Verification: AI UX E2E flows + approval logs review | Docs/API: docs/ai/features for IDE-101 |
| [ ] | IDE-102 | Patch rollback + audit log | AI IDE Features | AI | Foundation | P0 | Yes | Blocked until IDE-096 | Verification: AI UX E2E flows + approval logs review | Docs/API: docs/ai/features for IDE-102 |
| [ ] | IDE-103 | Prompt template management UI | AI IDE Features | AI | Expansion | P1 | No | Blocked until IDE-087 | Verification: AI UX E2E flows + approval logs review | Docs/API: docs/ai/features for IDE-103 |
| [ ] | IDE-104 | Model benchmarking harness integration | AI IDE Features | AI | Expansion | P1 | No | Blocked until IDE-090 | Verification: AI UX E2E flows + approval logs review | Docs/API: docs/ai/features for IDE-104 |
| [ ] | IDE-105 | Approval + guardrail UX | AI IDE Features | AI | Foundation | P0 | Yes | Blocked until IDE-102, IDE-091 | Verification: AI UX E2E flows + approval logs review | Docs/API: docs/ai/features for IDE-105 |
| [ ] | IDE-167 | AI diff reviewer & summaries | AI IDE Features | AI | Expansion | P1 | No | Blocked until IDE-055, IDE-094 | Verification: AI UX E2E flows + approval logs review | Docs/API: docs/ai/features for IDE-167 |

## Sprint S15

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [x] | IDE-106 | Settings schema + registry | Settings / Personalization | frontend | Foundation | P0 | Yes | Blocked until IDE-017 | Verification: Settings unit tests + GUI diff | Docs/API: docs/settings for IDE-106 |
| [x] | IDE-107 | Settings UI (GUI + JSON) | Settings / Personalization | frontend | Foundation | P0 | Yes | Blocked until IDE-106 | Verification: Settings unit tests + GUI diff | Docs/API: docs/settings for IDE-107 |
| [ ] | IDE-108 | Keymap editor | Settings / Personalization | frontend | Expansion | P1 | No | Blocked until IDE-012, IDE-106 | Verification: Settings unit tests + GUI diff | Docs/API: docs/settings for IDE-108 |
| [ ] | IDE-109 | Theme/Icon pack support | Settings / Personalization | frontend | Expansion | P1 | No | Blocked until IDE-021, IDE-198, IDE-199 | Verification: Settings unit tests + GUI diff | Docs/API: docs/settings for IDE-109 |
| [ ] | IDE-169 | Settings audit & policy hooks | Settings / Personalization | frontend | Expansion | P1 | No | Blocked until IDE-106, IDE-117 | Verification: Settings unit tests + GUI diff | Docs/API: docs/settings for IDE-169 |

## Sprint S16

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [ ] | IDE-099 | AI workspace assistant | AI IDE Features | AI | Vision | P2 | No | Blocked until IDE-089 | Verification: AI UX E2E flows + approval logs review | Docs/API: docs/ai/features for IDE-099 |
| [ ] | IDE-100 | AI agent task runner | AI IDE Features | AI | Vision | P2 | No | Blocked until IDE-089, IDE-069 | Verification: AI UX E2E flows + approval logs review | Docs/API: docs/ai/features for IDE-100 |
| [ ] | IDE-111 | Recent files + quick switcher | UX / Productivity Enhancements | frontend | Foundation | P1 | No | Blocked until IDE-017, IDE-049 | Verification: UX Playwright suite + Axe scans | Docs/API: docs/ux for IDE-111 |
| [ ] | IDE-112 | Outline + problems integration | UX / Productivity Enhancements | frontend | Foundation | P1 | No | Blocked until IDE-074, IDE-044 | Verification: UX Playwright suite + Axe scans | Docs/API: docs/ux for IDE-112 |
| [ ] | IDE-113 | Notifications center | UX / Productivity Enhancements | frontend | Expansion | P2 | No | Blocked until IDE-019 | Verification: UX Playwright suite + Axe scans | Docs/API: docs/ux for IDE-113 |
| [x] | IDE-114 | Accessibility pass | UX / Productivity Enhancements | frontend | Foundation | P0 | Yes | Blocked until IDE-017 | Verification: UX Playwright suite + Axe scans | Docs/API: docs/ux for IDE-114 |
| [ ] | IDE-115 | Welcome tours + tips | UX / Productivity Enhancements | frontend | Expansion | P2 | No | Blocked until IDE-022 | Verification: UX Playwright suite + Axe scans | Docs/API: docs/ux for IDE-115 |
| [ ] | IDE-116 | Command progress + notifications integration | UX / Productivity Enhancements | frontend | Foundation | P1 | No | Blocked until IDE-020, IDE-025 | Verification: UX Playwright suite + Axe scans | Docs/API: docs/ux for IDE-116 |
| [ ] | IDE-168 | AI code review scoreboard | AI IDE Features | AI | Vision | P2 | No | Blocked until IDE-167, IDE-090 | Verification: AI UX E2E flows + approval logs review | Docs/API: docs/ai/features for IDE-168 |

## Sprint S17

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [ ] | IDE-110 | Settings sync-ready architecture | Settings / Personalization | frontend | Vision | P2 | No | Blocked until IDE-106 | Verification: Settings unit tests + GUI diff | Docs/API: docs/settings for IDE-110 |
| [x] | IDE-117 | Telemetry platform | Observability / Reliability | infra | Foundation | P0 | Yes | Blocked until IDE-005, IDE-008 | Verification: Telemetry replay + health dashboards | Docs/API: docs/observability for IDE-117 |
| [ ] | IDE-118 | Performance tracing | Observability / Reliability | infra | Foundation | P1 | No | Blocked until IDE-117, IDE-016 | Verification: Telemetry replay + health dashboards | Docs/API: docs/observability for IDE-118 |
| [x] | IDE-119 | Crash reporting abstraction | Observability / Reliability | infra | Foundation | P0 | Yes | Blocked until IDE-015 | Verification: Telemetry replay + health dashboards | Docs/API: docs/observability for IDE-119 |
| [ ] | IDE-120 | Health diagnostics page | Observability / Reliability | infra | Expansion | P1 | No | Blocked until IDE-117, IDE-085 | Verification: Telemetry replay + health dashboards | Docs/API: docs/observability for IDE-120 |
| [x] | IDE-121 | Feature flag framework | Observability / Reliability | infra | Foundation | P0 | Yes | Blocked until IDE-005 | Verification: Telemetry replay + health dashboards | Docs/API: docs/observability for IDE-121 |
| [ ] | IDE-122 | Safe mode + extension bisect | Observability / Reliability | infra | Expansion | P1 | No | Blocked until IDE-084 | Verification: Telemetry replay + health dashboards | Docs/API: docs/observability for IDE-122 |
| [x] | IDE-170 | Telemetry consent & privacy center | Observability / Reliability | infra | Foundation | P0 | Yes | Blocked until IDE-117, IDE-106 | Verification: Telemetry replay + health dashboards | Docs/API: docs/observability for IDE-170 |
| [ ] | IDE-171 | Alerting & webhook integration | Observability / Reliability | infra | Expansion | P1 | No | Blocked until IDE-119, IDE-120 | Verification: Telemetry replay + health dashboards | Docs/API: docs/observability for IDE-171 |

## Sprint S18

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [x] | IDE-123 | IPC validation layer | Security & Compliance | infra | Foundation | P0 | Yes | Blocked until IDE-010 | Verification: Security automation + pentest checklist | Docs/API: docs/security for IDE-123 |
| [ ] | IDE-124 | Untrusted workspace model | Security & Compliance | infra | Foundation | P0 | Yes | Blocked until IDE-026, IDE-081 | Verification: Security automation + pentest checklist | Docs/API: docs/security for IDE-124 |
| [ ] | IDE-125 | Secrets redaction + vault integration | Security & Compliance | infra | Foundation | P0 | Yes | Blocked until IDE-008, IDE-091 | Verification: Security automation + pentest checklist | Docs/API: docs/security for IDE-125 |
| [ ] | IDE-126 | Sandboxed extension FS | Security & Compliance | infra | Expansion | P1 | No | Blocked until IDE-081 | Verification: Security automation + pentest checklist | Docs/API: docs/security for IDE-126 |
| [ ] | IDE-127 | Prompt injection defense suite | Security & Compliance | infra | Foundation | P1 | No | Blocked until IDE-091 | Verification: Security automation + pentest checklist | Docs/API: docs/security for IDE-127 |
| [ ] | IDE-128 | Secure update validation | Security & Compliance | infra | Phase 8 | P0 | No | Blocked until IDE-014 | Verification: Security automation + pentest checklist | Docs/API: docs/security for IDE-128 |
| [ ] | IDE-172 | Electron CSP & sandbox tightening | Security & Compliance | infra | Foundation | P0 | Yes | Blocked until IDE-010, IDE-123 | Verification: Security automation + pentest checklist | Docs/API: docs/security for IDE-172 |
| [ ] | IDE-173 | SBOM & dependency scanning | Security & Compliance | infra | Phase 8 | P0 | No | Blocked until IDE-006, IDE-132 | Verification: Security automation + pentest checklist | Docs/API: docs/security for IDE-173 |

## Sprint S19

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [ ] | IDE-129 | Cross-platform build pipeline | Packaging / Distribution | infra | Foundation | P0 | Yes | Blocked until IDE-005, IDE-009 | Verification: Installer smoke + signature validation | Docs/API: docs/releases for IDE-129 |
| [ ] | IDE-130 | Code signing hooks | Packaging / Distribution | infra | Phase 8 | P0 | No | Blocked until IDE-128 | Verification: Installer smoke + signature validation | Docs/API: docs/releases for IDE-130 |
| [ ] | IDE-131 | Installer UX + branding | Packaging / Distribution | infra | Expansion | P1 | No | Blocked until IDE-129 | Verification: Installer smoke + signature validation | Docs/API: docs/releases for IDE-131 |
| [ ] | IDE-132 | Auto-update release pipeline | Packaging / Distribution | infra | Phase 8 | P0 | No | Blocked until IDE-014, IDE-129 | Verification: Installer smoke + signature validation | Docs/API: docs/releases for IDE-132 |
| [ ] | IDE-133 | Artifact verification CLI | Packaging / Distribution | infra | Expansion | P1 | No | Blocked until IDE-128 | Verification: Installer smoke + signature validation | Docs/API: docs/releases for IDE-133 |
| [ ] | IDE-174 | Delta/differential updates | Packaging / Distribution | infra | Expansion | P1 | No | Blocked until IDE-014, IDE-132 | Verification: Installer smoke + signature validation | Docs/API: docs/releases for IDE-174 |
| [ ] | IDE-175 | Offline/air-gapped installer bundles | Packaging / Distribution | infra | Expansion | P1 | No | Blocked until IDE-129, IDE-133 | Verification: Installer smoke + signature validation | Docs/API: docs/releases for IDE-175 |

## Sprint S20

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [ ] | IDE-134 | Unit test harness | Testing / Quality Infrastructure | QA | Foundation | P0 | Yes | Blocked until IDE-006 | Verification: CI orchestration + test harness self-checks | Docs/API: docs/testing for IDE-134 |
| [ ] | IDE-135 | Integration + contract tests | Testing / Quality Infrastructure | QA | Foundation | P0 | Yes | Blocked until IDE-009, IDE-017 | Verification: CI orchestration + test harness self-checks | Docs/API: docs/testing for IDE-135 |
| [ ] | IDE-136 | AI quality evaluation suite | Testing / Quality Infrastructure | QA | Foundation | P1 | No | Blocked until IDE-090 | Verification: CI orchestration + test harness self-checks | Docs/API: docs/testing for IDE-136 |
| [ ] | IDE-137 | Performance regression tests | Testing / Quality Infrastructure | QA | Expansion | P1 | No | Blocked until IDE-016 | Verification: CI orchestration + test harness self-checks | Docs/API: docs/testing for IDE-137 |
| [ ] | IDE-138 | Extension compatibility tests | Testing / Quality Infrastructure | QA | Expansion | P1 | No | Blocked until IDE-079 | Verification: CI orchestration + test harness self-checks | Docs/API: docs/testing for IDE-138 |
| [ ] | IDE-139 | E2E smoke + chaos tests | Testing / Quality Infrastructure | QA | Expansion | P1 | No | Blocked until IDE-077, IDE-117 | Verification: CI orchestration + test harness self-checks | Docs/API: docs/testing for IDE-139 |
| [ ] | IDE-176 | Visual regression tests | Testing / Quality Infrastructure | QA | Expansion | P1 | No | Blocked until IDE-017, IDE-135 | Verification: CI orchestration + test harness self-checks | Docs/API: docs/testing for IDE-176 |
| [ ] | IDE-177 | AI red-team & safety suite | Testing / Quality Infrastructure | QA | Expansion | P0 | Yes | Blocked until IDE-091, IDE-136 | Verification: CI orchestration + test harness self-checks | Docs/API: docs/testing for IDE-177 |

## Sprint S21

| Status | ID | Title | Epic | Owner | Stage | Priority | Critical | Blockers | Verification | Docs/API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [ ] | IDE-140 | Architecture overview docs | Documentation & Enablement | QA | Foundation | P0 | Yes | Blocked until IDE-001 | Verification: Doc lint + SME review | Docs/API: docs/documentation for IDE-140 |
| [ ] | IDE-141 | Extension author guide | Documentation & Enablement | QA | Foundation | P1 | No | Blocked until IDE-076 | Verification: Doc lint + SME review | Docs/API: docs/documentation for IDE-141 |
| [ ] | IDE-142 | AI integration guide | Documentation & Enablement | QA | Foundation | P0 | Yes | Blocked until IDE-085 | Verification: Doc lint + SME review | Docs/API: docs/documentation for IDE-142 |
| [ ] | IDE-143 | Contributor guide + code standards | Documentation & Enablement | QA | Foundation | P0 | Yes | Blocked until IDE-003, IDE-007 | Verification: Doc lint + SME review | Docs/API: docs/documentation for IDE-143 |
| [ ] | IDE-144 | Release + troubleshooting playbooks | Documentation & Enablement | QA | Expansion | P1 | No | Blocked until IDE-132, IDE-119 | Verification: Doc lint + SME review | Docs/API: docs/documentation for IDE-144 |
| [ ] | IDE-178 | API reference automation | Documentation & Enablement | QA | Expansion | P1 | No | Blocked until IDE-079, IDE-140 | Verification: Doc lint + SME review | Docs/API: docs/documentation for IDE-178 |
| [ ] | IDE-179 | Enterprise deployment guide | Documentation & Enablement | QA | Expansion | P1 | No | Blocked until IDE-125, IDE-175 | Verification: Doc lint + SME review | Docs/API: docs/documentation for IDE-179 |
