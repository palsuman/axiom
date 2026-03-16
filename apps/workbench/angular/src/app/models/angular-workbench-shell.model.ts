import type { WorkbenchSnapshot } from '../../../../src/shell/workbench-shell-contract';
import type { AngularWorkbenchShellStatus } from '../types/workbench-shell-status';

export interface AngularWorkbenchShellModel {
  renderer: 'angular';
  env: string;
  platform: string;
  bridgeAvailable: boolean;
  status: AngularWorkbenchShellStatus;
  message: string;
  locale: string;
  supportedLocales: readonly string[];
  activeThemeId: string;
  shell: WorkbenchSnapshot;
}

export const INITIAL_ANGULAR_WORKBENCH_SHELL_MODEL: AngularWorkbenchShellModel = {
  renderer: 'angular',
  env: 'loading',
  platform: 'loading',
  bridgeAvailable: false,
  status: 'degraded',
  message: 'Loading Angular workbench shell.',
  locale: 'en-US',
  supportedLocales: ['en-US'],
  activeThemeId: 'Nexus Dark',
  shell: {
    activityBar: { width: 56, items: [], activeId: undefined },
    sidebar: { position: 'left', size: 320, collapsed: false, views: [], activeViewId: undefined },
    secondarySidebar: { position: 'right', size: 240, collapsed: true, views: [], activeViewId: undefined },
    panel: { position: 'bottom', size: 320, visible: true, views: [], activeViewId: undefined },
    editors: {
      activeGroupId: 'group-1',
      groups: [{ id: 'group-1', tabs: [] }],
      grid: {
        root: {
          id: 'dock-group-initial',
          kind: 'group',
          groupId: 'group-1',
          weight: 1
        }
      }
    },
    statusBar: { height: 24, items: [] },
    tokens: {},
    gridTemplate: { columns: '56px 320px 1fr', rows: '1fr 320px 24px' },
    placements: {
      activityBar: { id: 'activityBar', columnStart: 1, columnEnd: 2, rowStart: 1, rowEnd: 2, hidden: false },
      primarySidebar: { id: 'primarySidebar', columnStart: 2, columnEnd: 3, rowStart: 1, rowEnd: 2, hidden: false },
      secondarySidebar: { id: 'secondarySidebar', columnStart: 0, columnEnd: 0, rowStart: 1, rowEnd: 2, hidden: true },
      editor: { id: 'editor', columnStart: 3, columnEnd: 4, rowStart: 1, rowEnd: 2, hidden: false },
      panel: { id: 'panel', columnStart: 1, columnEnd: 4, rowStart: 2, rowEnd: 3, hidden: false },
      statusBar: { id: 'statusBar', columnStart: 1, columnEnd: 4, rowStart: 3, rowEnd: 4, hidden: false }
    },
    editorPlacements: {
      'group-1': {
        groupId: 'group-1',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        path: []
      }
    },
    notifications: {
      items: [],
      unseenCount: 0,
      severityTally: {
        info: 0,
        success: 0,
        warning: 0,
        error: 0
      },
      locale: 'en-US'
    }
  }
};
