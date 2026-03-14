import type { WorkbenchShell, WorkbenchSnapshot, EditorTabInit } from './workbench-shell';
import {
  WorkspaceStateStore,
  type WorkspaceStatePayload,
  type WorkspaceScmState,
  type WorkspaceEditorEntry
} from './workspace-state-store';

export type WorkspaceStateServiceOptions = {
  workspaceId: string;
  shell: WorkbenchShell;
  dataRoot?: string;
  debounceMs?: number;
};

const MAX_EDITORS = 20;

export class WorkspaceStateService {
  private readonly shell: WorkbenchShell;
  private readonly store: WorkspaceStateStore;
  private readonly debounceMs: number;
  private unsubscribe?: () => void;
  private debounceHandle?: NodeJS.Timeout;
  private pendingSnapshot?: WorkbenchSnapshot;
  private scmState?: WorkspaceScmState;

  constructor(options: WorkspaceStateServiceOptions) {
    this.shell = options.shell;
    this.store = new WorkspaceStateStore({ workspaceId: options.workspaceId, dataRoot: options.dataRoot });
    this.debounceMs = options.debounceMs ?? 250;
    this.unsubscribe = this.shell.onLayoutChange(snapshot => {
      this.schedulePersist(snapshot);
    });
  }

  async restore(): Promise<boolean> {
    const state = this.store.load();
    if (!state) return false;
    this.scmState = state.scm;
    this.restoreEditors(state);
    this.restoreViews(state);
    return true;
  }

  dispose() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    if (this.debounceHandle) {
      clearTimeout(this.debounceHandle);
      this.debounceHandle = undefined;
    }
  }

  updateScmState(state: WorkspaceScmState) {
    this.scmState = state;
    const snapshot = this.shell.layoutSnapshot();
    this.persist(snapshot);
  }

  private restoreEditors(state: WorkspaceStatePayload) {
    const snapshot = this.shell.layoutSnapshot();
    const existingResources = new Set<string>();
    snapshot.editors.groups.forEach(group => {
      group.tabs.forEach(tab => existingResources.add(tab.resource));
    });
    const editors = state.editors ?? [];
    const ordered = orderEditors(editors, state.activeEditorResource);
    ordered.forEach(entry => {
      if (!entry.resource) return;
      if (existingResources.has(entry.resource)) return;
      this.shell.openEditor(editorToTabInit(entry));
    });
    if (state.activeEditorResource) {
      this.shell.setActiveEditorByResource(state.activeEditorResource);
    }
  }

  private restoreViews(state: WorkspaceStatePayload) {
    if (state.activityBar?.activeId) {
      this.shell.activateActivity(state.activityBar.activeId);
    }
    if (state.sidebar?.activeViewId) {
      this.shell.setActiveSidebarView(state.sidebar.activeViewId, 'primary');
    }
    if (state.secondarySidebar?.activeViewId) {
      this.shell.setActiveSidebarView(state.secondarySidebar.activeViewId, 'secondary');
    }
    if (state.panel) {
      this.shell.togglePanelVisibility(state.panel.visible);
      if (state.panel.activeViewId) {
        this.shell.setActivePanelView(state.panel.activeViewId);
      }
    }
  }

  private schedulePersist(snapshot: WorkbenchSnapshot) {
    this.pendingSnapshot = snapshot;
    if (this.debounceMs === 0) {
      this.persist(snapshot);
      this.pendingSnapshot = undefined;
      return;
    }
    if (this.debounceHandle) {
      clearTimeout(this.debounceHandle);
    }
    this.debounceHandle = setTimeout(() => {
      if (this.pendingSnapshot) {
        this.persist(this.pendingSnapshot);
        this.pendingSnapshot = undefined;
      }
    }, this.debounceMs);
  }

  private persist(snapshot: WorkbenchSnapshot) {
    const payload = buildStatePayload(snapshot, this.scmState);
    this.store.save(payload);
  }
}

function orderEditors(editors: WorkspaceEditorEntry[], active?: string) {
  if (!active) return editors.slice(0, MAX_EDITORS);
  const preferred = editors.filter(entry => entry.resource === active);
  const others = editors.filter(entry => entry.resource !== active);
  return [...others.slice(0, MAX_EDITORS - preferred.length), ...preferred].slice(0, MAX_EDITORS);
}

function editorToTabInit(entry: WorkspaceEditorEntry): EditorTabInit {
  return {
    id: entry.groupId,
    title: entry.title,
    resource: entry.resource,
    kind: entry.kind
  };
}

function buildStatePayload(snapshot: WorkbenchSnapshot, scmState?: WorkspaceScmState): WorkspaceStatePayload {
  const editors: WorkspaceEditorEntry[] = [];
  snapshot.editors.groups.forEach(group => {
    group.tabs.forEach(tab => {
      editors.push({
        resource: tab.resource,
        title: tab.title,
        kind: tab.kind ?? 'text',
        groupId: group.id
      });
    });
  });
  const activeGroup = snapshot.editors.groups.find(group => group.id === snapshot.editors.activeGroupId);
  const activeTab =
    activeGroup?.tabs.find(tab => tab.id === activeGroup.activeTabId) ?? activeGroup?.tabs[0] ?? undefined;
  return {
    editors: editors.slice(0, MAX_EDITORS),
    activeEditorResource: activeTab?.resource,
    activityBar: { activeId: snapshot.activityBar.activeId },
    sidebar: { activeViewId: snapshot.sidebar.activeViewId },
    secondarySidebar: { activeViewId: snapshot.secondarySidebar.activeViewId },
    panel: { activeViewId: snapshot.panel.activeViewId, visible: snapshot.panel.visible },
    scm: scmState
  };
}
