# Git Repo Discovery (IDE-054)

## Goals
- Detect all Git repositories across single- and multi-root workspaces, including submodules and bare checkout scenarios.
- Keep head information up to date (<1s) so SCM panes can display the active branch/commit without running `git` repeatedly.
- Provide a reusable service in the Electron main process that exposes repository metadata to the renderer via typed IPC.

## Architecture

### Platform layer
- `packages/platform/scm/git/git-repository-manager.ts`
  - Scans each workspace root (configurable depth) for `.git` directories or `gitdir:` files.
  - Normalizes worktree roots and emits add/remove/change events.
  - Watches `HEAD` and `refs/heads/*` via `chokidar` to refresh branch information whenever commits switch.
  - Exposes `getRepositories()` so callers can snapshot the current list without mutating internal state.
- `packages/platform/scm/git/git-utils.ts`
  - Handles `gitdir:` resolution, bare repo detection, repository id hashing, and safe HEAD parsing.

### Desktop shell
- `apps/desktop-shell/src/scm/git-repository-service.ts`
  - Maintains a `GitRepositoryManager` per active window session.
  - Sessions are keyed by the WindowManager session id; whenever the workspace roots change, the service updates/creates the manager.
  - Repositories are cached in memory and surfaced through IPC (`nexus:git:list-repositories`).
- `apps/desktop-shell/src/bootstrap/bootstrap-desktop-shell.ts`
  - Tracks workspace lifecycle events (`onWindowReady`, session removal) to start/stop repository tracking.
  - IPC handler resolves the session associated with the requesting renderer and returns the latest repository list.

### Renderer
- `apps/workbench/src/scm/git-repository-store.ts`
  - Thin store that calls `window.nexus.gitListRepositories()` to hydrate SCM views.
  - Keeps an in-memory copy for consumers (status bar, future SCM panel).

## API

```ts
type GitRepositoryInfo = {
  id: string;
  worktreePath: string;
  gitDir: string;
  isBare: boolean;
  isSubmodule: boolean;
  head: { detached: boolean; ref?: string; commit?: string };
  lastChangedAt: number;
};
```

- IPC channel: `nexus:git:list-repositories` (renderer → main).
- Preload bridge: `window.nexus.gitListRepositories(): Promise<GitRepositoryInfo[]>`.

## Acceptance Criteria Trace
- ✅ Opening a workspace with multiple folders produces a repository list per root (unit tests cover standard and submodule layouts).
- ✅ HEAD changes (branch switch/commit) fire change events in <1 second thanks to `chokidar` watchers on `HEAD` and `refs/heads`.
- ✅ Submodules leveraging `gitdir:` indirection are resolved so SCM features can treat them as independent repositories.

# Status + Staging View (IDE-055)

## Goals
- Surface working tree, staged, and untracked files per repository with branch/ahead/behind metadata.
- Provide stage/unstage actions that immediately reflect in the renderer without reloading the workspace.
- Supply diff text (staged vs. working tree) so SCM panes can preview changes without invoking external tools.

## Architecture

### Platform layer
- `packages/platform/scm/git/git-status-service.ts`
  - Wraps `git status --porcelain`, `git add`, `git restore --staged`, and `git diff` via a hardened runner to avoid shell injection.
  - Parses porcelain output into typed `GitStatusSummary`/`GitStatusEntry` contracts (branch, upstream, ahead/behind, staged + working tree codes).
  - Computes diff summaries (additions/deletions) for quick badges in the UI.
  - Exported `parsePorcelainStatus` helper covered by unit tests with representative git output fixtures.

### Desktop shell
- `apps/desktop-shell/src/scm/git-repository-service.ts`
  - Now depends on `GitStatusService` and exposes `getStatus`, `stage`, `unstage`, and `getDiff` per session/repository.
  - Validates the requesting session (`WindowManager` metadata) before delegating to ensure untrusted windows cannot access other workspaces.
  - IPC handlers wired in `apps/desktop-shell/src/bootstrap/bootstrap-desktop-shell.ts` for:
    - `nexus:git:get-status`
    - `nexus:git:stage`
    - `nexus:git:unstage`
    - `nexus:git:get-diff`

### Renderer
- Contracts expanded in `packages/contracts/ipc.ts` to include `GitFileStatus`, `GitStatusSummary`, `GitStagePayload`, `GitDiffRequest`, and `GitDiffResponse`.
- `apps/workbench/src/scm/git-status-store.ts`
  - Central store with derived `staged`/`workingTree` lists, diff selection, optimistic loading flags, and listeners for workbench views.
  - Stage/unstage helpers call the preload bridge and automatically reapply summaries for near-instant UI updates.
  - Selection API fetches diffs (staged or working tree) and caches the latest response for preview panes.
- `apps/workbench/src/boot/workbench-bootstrap-context.ts`
  - Instantiates `GitRepositoryStore` + `GitStatusStore` + commit/history stores as part of renderer service composition.
- `apps/workbench/src/boot/workbench-bootstrap-contributions.ts`
  - Wires the Git status bar item (`status.git`) so branch and staged/unstaged counts track store updates.
- `apps/workbench/src/boot/workbench-bootstrap-commands.ts`
  - Registers `nexus.git.show`, `nexus.git.refreshStatus`, `nexus.git.stageAll`, `nexus.git.unstageAll`, and `nexus.git.focus`.
- `apps/workbench/src/boot/workbench-bootstrap-runtime.ts`
  - Automatically hydrates the first discovered repository on boot so SCM data is visible without manual refresh.

## API

```ts
type GitStatusEntry = {
  path: string;
  originalPath?: string;
  staged?: GitFileStatus;
  worktree?: GitFileStatus;
  conflicted?: boolean;
};

type GitStatusSummary = {
  repositoryId: string;
  worktreePath: string;
  branch?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  detached?: boolean;
  timestamp: number;
  entries: GitStatusEntry[];
};

type GitStagePayload = {
  repositoryId: string;
  paths: string[];
};

type GitDiffRequest = {
  repositoryId: string;
  path: string;
  staged?: boolean;
};

type GitDiffResponse = {
  repositoryId: string;
  path: string;
  staged: boolean;
  diff: string;
  summary: { additions: number; deletions: number };
};
```

- IPC channels: `nexus:git:get-status`, `nexus:git:stage`, `nexus:git:unstage`, `nexus:git:get-diff`.
- Preload bridge (`window.nexus`) exposes corresponding promise-based helpers, now typed in `apps/workbench/src/global.d.ts`.

## Acceptance Criteria Trace
- ✅ Stage/unstage operations invoke git once, return the new `GitStatusSummary`, and the renderer updates instantly (unit tests cover both store and service).
- ✅ Branch/ahead/behind/dirty counts are surfaced directly in the status bar item and update whenever workspace repositories change.
- ✅ Diff requests return raw text plus addition/deletion counts so SCM panes can preview patches without re-running git.

# Commit Composer + History (IDE-056)

## Goals
- Allow developers to compose commits (message, amend, sign-off) and dispatch them via the same sanitized bridge used by status/diff.
- Surface repository history with branch refs, search filters, and batching so panels can render graphs/logs without reimplementing `git log`.

## Architecture

### Platform layer
- `packages/platform/scm/git/git-commit-service.ts`
  - Wraps `git commit`, `git log`, and follow-up head description commands.
  - Uses structured outputs (custom separators) to parse history into stable DTOs without relying on locale-sensitive text.
  - Enforces message presence, clamps history limits, and supports optional `--signoff`, `--amend`, and `--allow-empty`.
- `apps/desktop-shell/src/scm/git-repository-service.ts`
  - Delegates `commit` and `getHistory` calls to the commit service and exposes them through the per-session repository manager.
- IPC additions:
  - `nexus:git:commit` ←→ `GitCommitPayload` / `GitCommitResult`
  - `nexus:git:get-history` ←→ `GitHistoryRequest` / `GitHistoryResponse`

### Renderer
- Contracts extended in `packages/contracts/ipc.ts` for commit + history payloads/results.
- Stores:
  - `GitCommitStore` manages draft state (message, sign-off, amend), dispatches commits, tracks last result/error.
  - `GitHistoryStore` handles paging/filtering for log entries and provides snapshots to Angular views.
- `apps/workbench/src/boot/workbench-bootstrap-context.ts`
  - Instantiates commit/history stores alongside repository/status stores so SCM runtime state has one composition root.
- `apps/workbench/src/boot/workbench-bootstrap-commands.ts`
  - Registers `nexus.git.setCommitMessage`, `nexus.git.commit`, `nexus.git.toggleSignOff`, `nexus.git.toggleAmend`, and `nexus.git.refreshHistory`.
  - Refreshes status + history after every commit to keep panels consistent.

## API

```ts
type GitCommitPayload = {
  repositoryId: string;
  message: string;
  amend?: boolean;
  signOff?: boolean;
  allowEmpty?: boolean;
};

type GitCommitResult = {
  repositoryId: string;
  commit: {
    sha: string;
    summary: string;
    body?: string;
    authorName: string;
    authorEmail: string;
    authorDate: number;
  };
  branch?: string;
};

type GitHistoryRequest = {
  repositoryId: string;
  limit?: number; // clamped to 1..200
  search?: string; // passed to --grep
};

type GitHistoryEntry = {
  sha: string;
  summary: string;
  body?: string;
  authorName: string;
  authorEmail: string;
  authorDate: number;
  committerName: string;
  committerEmail: string;
  committerDate: number;
  refs?: string[];
};
```

## Acceptance Criteria Trace
- ✅ Committing with amend/sign-off goes through `git commit` exactly once, returns the resulting head metadata, and clears the draft message.
- ✅ History requests stream structured entries (with refs/author/committer fields) and respect filters/limits for explorer/log UIs.
- ✅ Commands expose commit + history operations so components (panels, keybindings, AI commit assistant) can reuse the same API surface without duplicating git plumbing.
