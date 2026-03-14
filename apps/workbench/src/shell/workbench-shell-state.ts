import { createInitialGrid } from './editor-dock-grid';
import { createDefaultThemeCssVariables, DEFAULT_THEME_LAYOUT_TOKENS } from '@nexus/platform/theming/theme-registry';
import type { WorkbenchLayoutState } from './workbench-shell-contract';

const DEFAULT_ACTIVITY_WIDTH = Number.parseInt(DEFAULT_THEME_LAYOUT_TOKENS['activityBar.width'], 10);
const DEFAULT_STATUS_HEIGHT = Number.parseInt(DEFAULT_THEME_LAYOUT_TOKENS['statusBar.height'], 10);

export const MIN_SIDEBAR_WIDTH = 200;
export const MAX_SIDEBAR_WIDTH = 520;
export const MIN_PANEL_SIZE = 180;
export const MAX_PANEL_SIZE = 520;

const DEFAULT_TOKENS: Record<string, string> = Object.freeze(createDefaultThemeCssVariables('dark'));

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

export function cloneLayoutState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function clampRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
