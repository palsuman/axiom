import type { LocalizedText } from '../i18n/i18n-service';
import type { NotificationSnapshot } from './notification-center';
import type { EditorGridState, EditorGroupPlacement } from './editor-dock-grid';

export type Alignment = 'left' | 'right';
export type PanelPosition = 'bottom' | 'right';
export type SidebarPosition = 'left' | 'right';

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

export type EditorTabState = Required<EditorTabInit>;

export type ActivityBarState = {
  width: number;
  items: ActivityRegistration[];
  activeId?: string;
};

export type SidebarState = {
  position: SidebarPosition;
  size: number;
  collapsed: boolean;
  views: SidebarViewRegistration[];
  activeViewId?: string;
};

export type PanelState = {
  position: PanelPosition;
  size: number;
  visible: boolean;
  views: PanelViewRegistration[];
  activeViewId?: string;
};

export type EditorGroupState = {
  id: string;
  tabs: EditorTabState[];
  activeTabId?: string;
};

export type StatusBarState = {
  height: number;
  items: StatusBarItemRegistration[];
};

export type EditorAreaState = {
  activeGroupId: string;
  groups: EditorGroupState[];
  grid: EditorGridState;
};

export type WorkbenchSurface =
  | 'activityBar'
  | 'primarySidebar'
  | 'secondarySidebar'
  | 'editor'
  | 'panel'
  | 'statusBar';

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

export type WorkbenchSnapshot = WorkbenchLayoutState & {
  gridTemplate: GridTemplate;
  placements: Record<WorkbenchSurface, SurfacePlacement>;
  editorPlacements: Record<string, EditorGroupPlacement>;
  notifications: NotificationSnapshot;
};

export type WorkbenchLayoutListener = (snapshot: WorkbenchSnapshot, reason: WorkbenchChangeReason) => void;

export const DEFAULT_ACTIVITY_ITEMS: ActivityRegistration[] = [
  { id: 'activity.explorer', title: 'Explorer', icon: 'files', order: 1, commandId: 'nexus.explorer.focus' },
  { id: 'activity.search', title: 'Search', icon: 'search', order: 2, commandId: 'nexus.search.focus' },
  { id: 'activity.git', title: 'Source Control', icon: 'git-branch', order: 3, commandId: 'nexus.git.focus' },
  { id: 'activity.run', title: 'Run & Debug', icon: 'debug-alt', order: 4, commandId: 'nexus.run.focus' },
  { id: 'activity.extensions', title: 'Extensions', icon: 'extensions', order: 5, commandId: 'nexus.extensions.focus' },
  { id: 'activity.chat', title: 'AI', icon: 'sparkle', order: 6, commandId: 'nexus.ai.chat' }
];
