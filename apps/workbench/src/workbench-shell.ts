import {
  type DockOrientation,
  type EditorGridState,
  type EditorGroupPlacement,
  computeEditorPlacements,
  createInitialGrid,
  removeGroupNode,
  splitGroupNode
} from './editor-dock-grid';
import {
  NotificationCenter,
  type NotificationPayload,
  type NotificationSnapshot
} from './notification-center';
import { I18nService, type LocalizedText } from './i18n-service';

type Alignment = 'left' | 'right';
type PanelPosition = 'bottom' | 'right';
type SidebarPosition = 'left' | 'right';

export type ActivityRegistration = {
  id: string;
  title: string;
  icon?: string;
  order: number;
  commandId: string;
};

export type SidebarViewRegistration = {
  id: string;
  title: string;
  order: number;
  icon?: string;
  containerId?: string;
};

export type PanelViewRegistration = {
  id: string;
  title: string;
  order: number;
  embeddedCommandId?: string;
};

export type StatusContent = string | LocalizedText;

export type StatusBarItemRegistration = {
  id: string;
  alignment: Alignment;
  text: StatusContent;
  commandId?: string;
  priority?: number;
  severity?: 'info' | 'warning' | 'error';
  tooltip?: StatusContent;
  ariaLabel?: StatusContent;
  visible?: boolean;
  progress?: {
    value: number;
    total?: number;
  };
};

export type EditorTabInit = {
  id?: string;
  title: string;
  resource: string;
  kind?: 'text' | 'preview' | 'diff';
};

type ActivityBarState = {
  width: number;
  items: ActivityRegistration[];
  activeId?: string;
};

type SidebarState = {
  position: SidebarPosition;
  size: number;
  collapsed: boolean;
  views: SidebarViewRegistration[];
  activeViewId?: string;
};

type PanelState = {
  position: PanelPosition;
  size: number;
  visible: boolean;
  views: PanelViewRegistration[];
  activeViewId?: string;
};

type EditorGroupState = {
  id: string;
  tabs: EditorTabState[];
  activeTabId?: string;
};

type EditorTabState = Required<EditorTabInit>;

type StatusBarState = {
  height: number;
  items: StatusBarItemRegistration[];
};

type EditorAreaState = {
  activeGroupId: string;
  groups: EditorGroupState[];
  grid: EditorGridState;
};

export type WorkbenchSurface = 'activityBar' | 'primarySidebar' | 'secondarySidebar' | 'editor' | 'panel' | 'statusBar';

export type SurfacePlacement = {
  id: WorkbenchSurface;
  columnStart: number;
  columnEnd: number;
  rowStart: number;
  rowEnd: number;
  hidden: boolean;
};

export type WorkbenchLayoutState = {
  activityBar: ActivityBarState;
  sidebar: SidebarState;
  secondarySidebar: SidebarState;
  panel: PanelState;
  editors: EditorAreaState;
  statusBar: StatusBarState;
  tokens: Record<string, string>;
};

export type GridTemplate = {
  columns: string;
  rows: string;
};

export type WorkbenchChangeReason = 'activity' | 'sidebar' | 'panel' | 'status' | 'editors' | 'theme';

export type WorkbenchLayoutListener = (snapshot: WorkbenchSnapshot, reason: WorkbenchChangeReason) => void;

export type WorkbenchSnapshot = WorkbenchLayoutState & {
  gridTemplate: GridTemplate;
  placements: Record<WorkbenchSurface, SurfacePlacement>;
  editorPlacements: Record<string, EditorGroupPlacement>;
  notifications: NotificationSnapshot;
};

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 520;
const MIN_PANEL_SIZE = 180;
const MAX_PANEL_SIZE = 520;
const DEFAULT_ACTIVITY_WIDTH = 56;
const DEFAULT_STATUS_HEIGHT = 26;

let idCounter = 0;

function generateId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter.toString(36)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const DEFAULT_TOKENS: Record<string, string> = Object.freeze({
  '--nexus-workbench-bg': '#1e1e1e',
  '--nexus-activity-bar-bg': '#252526',
  '--nexus-sidebar-bg': '#1e1e1e',
  '--nexus-panel-bg': '#1e1e1e',
  '--nexus-status-bar-bg': '#007acc',
  '--nexus-status-bar-fg': '#fff'
});

export function createDefaultLayoutState(): WorkbenchLayoutState {
  return {
    activityBar: { width: DEFAULT_ACTIVITY_WIDTH, items: [] },
    sidebar: {
      position: 'left',
      size: 320,
      collapsed: false,
      views: []
    },
    secondarySidebar: {
      position: 'right',
      size: 240,
      collapsed: true,
      views: []
    },
    panel: {
      position: 'bottom',
      size: 320,
      visible: true,
      views: []
    },
    editors: {
      activeGroupId: 'group-1',
      groups: [{ id: 'group-1', tabs: [] }],
      grid: createInitialGrid('group-1')
    },
    statusBar: {
      height: DEFAULT_STATUS_HEIGHT,
      items: []
    },
    tokens: { ...DEFAULT_TOKENS }
  };
}

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export class WorkbenchShell {
  private readonly state: WorkbenchLayoutState;
  private activityBarLocked = false;
  private readonly listeners = new Set<WorkbenchLayoutListener>();
  private readonly notificationCenter: NotificationCenter;
  private readonly i18n: I18nService;

  constructor(initialState: WorkbenchLayoutState = createDefaultLayoutState(), options: { i18n?: I18nService } = {}) {
    this.state = deepCopy(initialState);
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
    bucket.size = clamp(width, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);
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
    this.state.panel.size = clamp(size, MIN_PANEL_SIZE, MAX_PANEL_SIZE);
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
    const { template, placements } = this.computeGridStructure();
    const editorPlacements = computeEditorPlacements(this.state.editors.grid);
    const notifications = this.notificationCenter.getSnapshot();
    return {
      ...deepCopy(this.state),
      gridTemplate: template,
      placements,
      editorPlacements,
      notifications
    };
  }

  getThemeTokens() {
    return { ...this.state.tokens };
  }

  getLocale() {
    return this.i18n.getLocale();
  }

  private computeGridStructure(): { template: GridTemplate; placements: Record<WorkbenchSurface, SurfacePlacement> } {
    const columnSizes: string[] = [];
    const columnSurfaces: WorkbenchSurface[] = [];
    const pushColumn = (surface: WorkbenchSurface, size: string) => {
      columnSizes.push(size);
      columnSurfaces.push(surface);
    };

    pushColumn('activityBar', `${this.state.activityBar.width}px`);

    if (!this.state.sidebar.collapsed && this.state.sidebar.position === 'left') {
      pushColumn('primarySidebar', `${this.state.sidebar.size}px`);
    }
    if (!this.state.secondarySidebar.collapsed && this.state.secondarySidebar.position === 'left') {
      pushColumn('secondarySidebar', `${this.state.secondarySidebar.size}px`);
    }

    pushColumn('editor', '1fr');

    if (!this.state.sidebar.collapsed && this.state.sidebar.position === 'right') {
      pushColumn('primarySidebar', `${this.state.sidebar.size}px`);
    }
    if (!this.state.secondarySidebar.collapsed && this.state.secondarySidebar.position === 'right') {
      pushColumn('secondarySidebar', `${this.state.secondarySidebar.size}px`);
    }
    if (this.state.panel.visible && this.state.panel.position === 'right') {
      pushColumn('panel', `${this.state.panel.size}px`);
    }

    const columnPositions: Partial<Record<WorkbenchSurface, { start: number; end: number }>> = {};
    columnSurfaces.forEach((surface, index) => {
      columnPositions[surface] = { start: index + 1, end: index + 2 };
    });

    const rows = ['1fr'];
    const panelBottomVisible = this.state.panel.visible && this.state.panel.position === 'bottom';
    if (panelBottomVisible) {
      rows.push(`${this.state.panel.size}px`);
    }
    rows.push(`${this.state.statusBar.height}px`);

    const totalColumns = columnSizes.length || 1;
    const panelRowStart = panelBottomVisible ? 2 : null;
    const statusRowStart = panelBottomVisible ? 3 : 2;

    const placements: Record<WorkbenchSurface, SurfacePlacement> = {
      activityBar: this.buildPlacement('activityBar', columnPositions.activityBar, {
        rowStart: 1,
        rowEnd: 2
      }),
      primarySidebar: this.buildPlacement('primarySidebar', columnPositions.primarySidebar, {
        rowStart: 1,
        rowEnd: 2,
        hidden: this.state.sidebar.collapsed
      }),
      secondarySidebar: this.buildPlacement('secondarySidebar', columnPositions.secondarySidebar, {
        rowStart: 1,
        rowEnd: 2,
        hidden: this.state.secondarySidebar.collapsed
      }),
      editor: this.buildPlacement('editor', columnPositions.editor, {
        rowStart: 1,
        rowEnd: 2
      }),
      panel: this.buildPlacement(
        'panel',
        columnPositions.panel,
        panelBottomVisible
          ? {
              rowStart: panelRowStart ?? 1,
              rowEnd: (panelRowStart ?? 1) + 1,
              hidden: false,
              fallbackColumns: [1, totalColumns + 1]
            }
          : {
              rowStart: 1,
              rowEnd: 2,
              hidden: !this.state.panel.visible
            }
      ),
      statusBar: this.buildPlacement('statusBar', undefined, {
        rowStart: statusRowStart,
        rowEnd: statusRowStart + 1,
        hidden: false,
        fallbackColumns: [1, totalColumns + 1]
      })
    };

    return {
      template: {
        columns: columnSizes.join(' '),
        rows: rows.join(' ')
      },
      placements
    };
  }

  private buildPlacement(
    id: WorkbenchSurface,
    coords: { start: number; end: number } | undefined,
    options: { rowStart: number; rowEnd: number; hidden?: boolean; fallbackColumns?: [number, number] }
  ): SurfacePlacement {
    const fallback = options.fallbackColumns;
    const columnStart = coords?.start ?? fallback?.[0] ?? 0;
    const columnEnd = coords?.end ?? fallback?.[1] ?? columnStart;
    const hidden = options.hidden ?? (!coords && !fallback);
    return {
      id,
      columnStart,
      columnEnd,
      rowStart: options.rowStart,
      rowEnd: options.rowEnd,
      hidden
    };
  }

  private findEditorGroup(id?: string) {
    return (
      this.state.editors.groups.find(group => group.id === id) ?? this.state.editors.groups[0]
    );
  }

  private refreshNotificationStatus(snapshot = this.notificationCenter.getSnapshot()) {
    const count = snapshot.unseenCount;
    const statusText: StatusContent = count
      ? this.i18n.translate(count === 1 ? 'status.notifications.count.one' : 'status.notifications.count.other', {
          fallback: count === 1 ? '{count} Notification' : '{count} Notifications',
          args: { count }
        })
      : this.i18n.translate('status.notifications.none', {
          fallback: '0 Notifications'
        });
    this.registerStatusItem({
      id: 'status.notifications',
      alignment: 'right',
      text: statusText,
      commandId: 'nexus.notifications.show',
      priority: 10,
      tooltip: this.i18n.translate(
        count ? 'status.notifications.tooltip.pending' : 'status.notifications.tooltip.none',
        {
          fallback: count ? 'View pending notifications' : 'All caught up'
        }
      ),
      ariaLabel: this.i18n.translate(
        count ? 'status.notifications.aria.pending' : 'status.notifications.aria.none',
        {
          fallback: count ? '{count} pending notifications' : 'No pending notifications',
          args: { count }
        }
      )
    });
  }
}

export const DEFAULT_ACTIVITY_ITEMS: ActivityRegistration[] = [
  { id: 'activity.explorer', title: 'Explorer', icon: 'files', order: 1, commandId: 'nexus.explorer.focus' },
  { id: 'activity.search', title: 'Search', icon: 'search', order: 2, commandId: 'nexus.search.focus' },
  { id: 'activity.git', title: 'Source Control', icon: 'git-branch', order: 3, commandId: 'nexus.git.focus' },
  { id: 'activity.run', title: 'Run & Debug', icon: 'debug-alt', order: 4, commandId: 'nexus.run.focus' },
  { id: 'activity.extensions', title: 'Extensions', icon: 'extensions', order: 5, commandId: 'nexus.extensions.focus' },
  { id: 'activity.chat', title: 'AI', icon: 'sparkle', order: 6, commandId: 'nexus.ai.chat' }
];
