import fs from 'node:fs';
import path from 'node:path';
import type { I18nService } from './i18n-service';
import { WorkbenchLayoutState, WorkbenchShell, WorkbenchSnapshot, createDefaultLayoutState } from './workbench-shell';
import { resolveWorkspaceDataRoot, sanitizeWorkspaceId } from '@nexus/platform/workspace-paths';

const LAYOUT_VERSION = 1;

export type WorkbenchLayoutStoreOptions = {
  workspaceId: string;
  dataRoot?: string;
};

type PersistedLayout = {
  version: number;
  updatedAt: number;
  state: WorkbenchLayoutState;
};

export class WorkbenchLayoutStore {
  private readonly dir: string;
  private readonly filePath: string;

  constructor(private readonly options: WorkbenchLayoutStoreOptions) {
    this.dir = resolveWorkspaceDataRoot(options.dataRoot);
    this.filePath = path.join(this.dir, `${sanitizeWorkspaceId(options.workspaceId)}.layout.json`);
  }

  loadState(): WorkbenchLayoutState | null {
    return this.readState();
  }

  saveSnapshot(snapshot: WorkbenchSnapshot) {
    this.writeState(this.stripSnapshot(snapshot));
  }

  getFilePath() {
    return this.filePath;
  }

  private stripSnapshot(snapshot: WorkbenchSnapshot): WorkbenchLayoutState {
    const state = { ...snapshot };
    delete (state as Partial<WorkbenchSnapshot>).gridTemplate;
    delete (state as Partial<WorkbenchSnapshot>).placements;
    delete (state as Partial<WorkbenchSnapshot>).editorPlacements;
    delete (state as Partial<WorkbenchSnapshot>).notifications;
    return state as WorkbenchLayoutState;
  }

  private readState(): WorkbenchLayoutState | null {
    if (!fs.existsSync(this.filePath)) return null;
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as PersistedLayout;
      if (parsed.version !== LAYOUT_VERSION || !parsed.state) return null;
      return this.mergeWithDefault(parsed.state);
    } catch {
      return null;
    }
  }

  private writeState(state: WorkbenchLayoutState) {
    const payload: PersistedLayout = {
      version: LAYOUT_VERSION,
      updatedAt: Date.now(),
      state
    };
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }

  private mergeWithDefault(state: Partial<WorkbenchLayoutState>): WorkbenchLayoutState {
    const base = createDefaultLayoutState();
    return {
      ...base,
      ...state,
      activityBar: { ...base.activityBar, ...(state.activityBar ?? {}) },
      sidebar: { ...base.sidebar, ...(state.sidebar ?? {}) },
      secondarySidebar: { ...base.secondarySidebar, ...(state.secondarySidebar ?? {}) },
      panel: { ...base.panel, ...(state.panel ?? {}) },
      editors: {
        ...base.editors,
        ...(state.editors ?? {}),
        grid: state.editors?.grid ?? base.editors.grid,
        groups:
          Array.isArray(state.editors?.groups) && state.editors?.groups.length
            ? state.editors.groups
            : base.editors.groups
      },
      statusBar: { ...base.statusBar, ...(state.statusBar ?? {}) },
      tokens: { ...base.tokens, ...(state.tokens ?? {}) }
    };
  }
}

export type PersistentWorkbenchShellOptions = WorkbenchLayoutStoreOptions & {
  persist?: boolean;
  i18n?: I18nService;
};

export function bootstrapPersistentWorkbenchShell(options: PersistentWorkbenchShellOptions) {
  const store = new WorkbenchLayoutStore(options);
  const restoredState = store.loadState() ?? createDefaultLayoutState();
  const shell = new WorkbenchShell(restoredState, { i18n: options.i18n });
  let unsubscribe: (() => void) | null = null;
  if (options.persist !== false) {
    unsubscribe = shell.onLayoutChange(snapshot => store.saveSnapshot(snapshot));
  }
  return {
    shell,
    store,
    dispose: () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    }
  };
}
