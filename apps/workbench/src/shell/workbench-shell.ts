import {
  type DockOrientation,
  removeGroupNode,
  splitGroupNode
} from './editor-dock-grid';
import {
  NotificationCenter,
  type NotificationPayload
} from './notification-center';
import { I18nService } from '../i18n/i18n-service';
import { createWorkbenchSnapshot } from './workbench-shell-layout';
import { createNotificationStatusItem } from './workbench-shell-status';
import {
  clampRange,
  cloneLayoutState,
  createDefaultLayoutState,
  MAX_PANEL_SIZE,
  MAX_SIDEBAR_WIDTH,
  MIN_PANEL_SIZE,
  MIN_SIDEBAR_WIDTH
} from './workbench-shell-state';
import type {
  ActivityRegistration,
  EditorGroupState,
  EditorTabInit,
  EditorTabState,
  PanelPosition,
  PanelViewRegistration,
  SidebarPosition,
  SidebarViewRegistration,
  StatusBarItemRegistration,
  WorkbenchChangeReason,
  WorkbenchLayoutListener,
  WorkbenchLayoutState,
  WorkbenchSnapshot
} from './workbench-shell-contract';
export {
  DEFAULT_ACTIVITY_ITEMS,
  type ActivityRegistration,
  type EditorTabInit,
  type GridTemplate,
  type PanelViewRegistration,
  type SidebarViewRegistration,
  type StatusBarItemRegistration,
  type StatusContent,
  type SurfacePlacement,
  type WorkbenchChangeReason,
  type WorkbenchLayoutListener,
  type WorkbenchLayoutState,
  type WorkbenchSnapshot,
  type WorkbenchSurface
} from './workbench-shell-contract';
export { createDefaultLayoutState } from './workbench-shell-state';

let idCounter = 0;

function generateId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter.toString(36)}`;
}

export class WorkbenchShell {
  private readonly state: WorkbenchLayoutState;
  private activityBarLocked = false;
  private readonly listeners = new Set<WorkbenchLayoutListener>();
  private readonly notificationCenter: NotificationCenter;
  private readonly i18n: I18nService;

  constructor(initialState: WorkbenchLayoutState = createDefaultLayoutState(), options: { i18n?: I18nService } = {}) {
    this.state = cloneLayoutState(initialState);
    this.i18n =
      options.i18n ??
      new I18nService({
        locale: process.env.NEXUS_LOCALE ?? 'en-US'
      });
    this.notificationCenter = new NotificationCenter({ i18n: this.i18n });
    this.notificationCenter.onDidChange(snapshot => {
      this.refreshNotificationStatus(snapshot);
    });
    this.i18n.onDidChangeLocale(() => {
      this.refreshNotificationStatus();
      this.emitChange('status');
    });
    this.refreshNotificationStatus();
  }

  onLayoutChange(listener: WorkbenchLayoutListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitChange(reason: WorkbenchChangeReason) {
    if (!this.listeners.size) return;
    const snapshot = this.layoutSnapshot();
    this.listeners.forEach(listener => listener(snapshot, reason));
  }

  registerActivity(activity: ActivityRegistration) {
    const items = this.state.activityBar.items;
    const index = items.findIndex(item => item.id === activity.id);
    if (index >= 0) {
      items[index] = activity;
    } else {
      items.push(activity);
    }
    items.sort((a, b) => a.order - b.order);
    if (!this.activityBarLocked) {
      this.state.activityBar.activeId = items[0]?.id;
    }
    this.emitChange('activity');
  }

  activateActivity(id: string) {
    if (this.state.activityBar.items.some(item => item.id === id)) {
      this.state.activityBar.activeId = id;
      this.activityBarLocked = true;
      this.emitChange('activity');
    }
  }

  registerSidebarView(view: SidebarViewRegistration, target: 'primary' | 'secondary' = 'primary') {
    const bucket = target === 'primary' ? this.state.sidebar : this.state.secondarySidebar;
    const index = bucket.views.findIndex(v => v.id === view.id);
    if (index >= 0) {
      bucket.views[index] = view;
    } else {
      bucket.views.push(view);
    }
    bucket.views.sort((a, b) => a.order - b.order);
    bucket.activeViewId = bucket.activeViewId ?? view.id;
    this.emitChange('sidebar');
  }

  registerPanelView(view: PanelViewRegistration) {
    const bucket = this.state.panel;
    const index = bucket.views.findIndex(v => v.id === view.id);
    if (index >= 0) {
      bucket.views[index] = view;
    } else {
      bucket.views.push(view);
    }
    bucket.views.sort((a, b) => a.order - b.order);
    bucket.activeViewId = bucket.activeViewId ?? view.id;
    this.emitChange('panel');
  }

  setActiveSidebarView(viewId: string, target: 'primary' | 'secondary' = 'primary') {
    const bucket = target === 'primary' ? this.state.sidebar : this.state.secondarySidebar;
    if (!bucket.views.some(view => view.id === viewId)) {
      return false;
    }
    bucket.activeViewId = viewId;
    this.emitChange('sidebar');
    return true;
  }

  setActivePanelView(viewId: string) {
    if (!this.state.panel.views.some(view => view.id === viewId)) {
      return false;
    }
    this.state.panel.activeViewId = viewId;
    this.emitChange('panel');
    return true;
  }

  registerStatusItem(item: StatusBarItemRegistration) {
    const items = this.state.statusBar.items;
    const index = items.findIndex(existing => existing.id === item.id);
    if (item.visible === undefined) {
      item.visible = true;
    }
    if (index >= 0) {
      items[index] = item;
    } else {
      items.push(item);
    }
    items.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    this.emitChange('status');
  }

  setStatusItemVisibility(id: string, visible: boolean) {
    const items = this.state.statusBar.items;
    const existing = items.find(item => item.id === id);
    if (!existing) return false;
    existing.visible = visible;
    this.emitChange('status');
    return true;
  }

  setSidebarSize(width: number, target: 'primary' | 'secondary' = 'primary') {
    const bucket = target === 'primary' ? this.state.sidebar : this.state.secondarySidebar;
    bucket.size = clampRange(width, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);
    if (bucket.size > MIN_SIDEBAR_WIDTH) {
      bucket.collapsed = false;
    }
    this.emitChange('sidebar');
  }

  toggleSidebarCollapsed(target: 'primary' | 'secondary' = 'primary') {
    const bucket = target === 'primary' ? this.state.sidebar : this.state.secondarySidebar;
    bucket.collapsed = !bucket.collapsed;
    this.emitChange('sidebar');
  }

  setSidebarPosition(position: SidebarPosition, target: 'primary' | 'secondary' = 'primary') {
    const bucket = target === 'primary' ? this.state.sidebar : this.state.secondarySidebar;
    bucket.position = position;
    this.emitChange('sidebar');
  }

  setPanelSize(size: number) {
    this.state.panel.size = clampRange(size, MIN_PANEL_SIZE, MAX_PANEL_SIZE);
    this.emitChange('panel');
  }

  togglePanelVisibility(force?: boolean) {
    const desired = typeof force === 'boolean' ? force : !this.state.panel.visible;
    this.state.panel.visible = desired;
    this.emitChange('panel');
  }

  setPanelPosition(position: PanelPosition) {
    this.state.panel.position = position;
    this.emitChange('panel');
  }

  openEditor(tabInit: EditorTabInit, targetGroupId?: string): EditorTabState {
    const group = this.findEditorGroup(targetGroupId ?? this.state.editors.activeGroupId);
    const existing = group.tabs.find(tab => tab.resource === tabInit.resource);
    if (existing) {
      group.activeTabId = existing.id;
      this.state.editors.activeGroupId = group.id;
      this.emitChange('editors');
      return existing;
    }
    const tabState: EditorTabState = {
      id: tabInit.id ?? generateId('tab'),
      title: tabInit.title,
      resource: tabInit.resource,
      kind: tabInit.kind ?? 'text'
    };
    group.tabs.push(tabState);
    group.activeTabId = tabState.id;
    this.state.editors.activeGroupId = group.id;
    this.emitChange('editors');
    return tabState;
  }

  setActiveEditorByResource(resource: string) {
    const group = this.state.editors.groups.find(candidate => candidate.tabs.some(tab => tab.resource === resource));
    if (!group) return false;
    const tab = group.tabs.find(entry => entry.resource === resource);
    if (!tab) return false;
    group.activeTabId = tab.id;
    this.state.editors.activeGroupId = group.id;
    this.emitChange('editors');
    return true;
  }

  splitEditor(direction: DockOrientation, referenceGroupId?: string) {
    const parent = this.findEditorGroup(referenceGroupId ?? this.state.editors.activeGroupId);
    const newGroup: EditorGroupState = {
      id: generateId(direction === 'horizontal' ? 'h' : 'v'),
      tabs: [],
      activeTabId: undefined
    };
    this.state.editors.groups.push(newGroup);
    splitGroupNode(this.state.editors.grid, parent.id, direction, newGroup.id);
    this.state.editors.activeGroupId = newGroup.id;
    this.emitChange('editors');
    return newGroup.id;
  }

  moveEditorTab(tabId: string, targetGroupId: string, targetIndex?: number) {
    const sourceGroup = this.state.editors.groups.find(group => group.tabs.some(tab => tab.id === tabId));
    const targetGroup = this.state.editors.groups.find(group => group.id === targetGroupId);
    if (!sourceGroup || !targetGroup) {
      return false;
    }
    const tabIndex = sourceGroup.tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex < 0) return false;
    const [tab] = sourceGroup.tabs.splice(tabIndex, 1);
    let insertIndex = Math.max(0, Math.min(targetGroup.tabs.length, targetIndex ?? targetGroup.tabs.length));
    if (sourceGroup === targetGroup && insertIndex > tabIndex) {
      insertIndex -= 1;
    }
    targetGroup.tabs.splice(insertIndex, 0, tab);
    this.state.editors.activeGroupId = targetGroup.id;
    targetGroup.activeTabId = tab.id;
    if (sourceGroup.activeTabId === tab.id) {
      sourceGroup.activeTabId = sourceGroup.tabs[0]?.id;
    }
    this.emitChange('editors');
    return true;
  }

  closeEditor(tabId: string, options?: { preserveEmptyGroup?: boolean }) {
    const group = this.state.editors.groups.find(g => g.tabs.some(tab => tab.id === tabId));
    if (!group) return false;
    const idx = group.tabs.findIndex(tab => tab.id === tabId);
    if (idx < 0) return false;
    group.tabs.splice(idx, 1);
    if (group.activeTabId === tabId) {
      group.activeTabId = group.tabs[0]?.id;
    }
    const shouldRemoveGroup = !group.tabs.length && !options?.preserveEmptyGroup;
    const removedGroup = shouldRemoveGroup ? this.closeEditorGroup(group.id, { preserveIfLast: true }) : false;
    if (!removedGroup) {
      this.emitChange('editors');
    }
    return true;
  }

  closeEditorGroup(groupId: string, options?: { preserveIfLast?: boolean }) {
    const groups = this.state.editors.groups;
    if (groups.length <= 1 && options?.preserveIfLast !== false) {
      return false;
    }
    const index = groups.findIndex(group => group.id === groupId);
    if (index < 0) return false;
    const removedFromGrid = removeGroupNode(this.state.editors.grid, groupId);
    if (!removedFromGrid) return false;
    groups.splice(index, 1);
    if (this.state.editors.activeGroupId === groupId) {
      this.state.editors.activeGroupId = groups[0]?.id ?? '';
    }
    this.emitChange('editors');
    return true;
  }

  pushNotification(payload: NotificationPayload) {
    return this.notificationCenter.push(payload);
  }

  dismissNotification(id: string) {
    return this.notificationCenter.dismiss(id);
  }

  getNotificationSnapshot() {
    return this.notificationCenter.getSnapshot();
  }

  applyThemeOverrides(tokens: Record<string, string>) {
    this.state.tokens = { ...this.state.tokens, ...tokens };
    this.emitChange('theme');
  }

  layoutSnapshot(): WorkbenchSnapshot {
    return createWorkbenchSnapshot(this.state, this.notificationCenter.getSnapshot());
  }

  getThemeTokens() {
    return { ...this.state.tokens };
  }

  getLocale() {
    return this.i18n.getLocale();
  }

  private findEditorGroup(id?: string) {
    return (
      this.state.editors.groups.find(group => group.id === id) ?? this.state.editors.groups[0]
    );
  }

  private refreshNotificationStatus(snapshot = this.notificationCenter.getSnapshot()) {
    this.registerStatusItem(createNotificationStatusItem(this.i18n, snapshot));
  }
}
