import { computeEditorPlacements } from './editor-dock-grid';
import type {
  GridTemplate,
  SurfacePlacement,
  WorkbenchLayoutState,
  WorkbenchSnapshot,
  WorkbenchSurface
} from './workbench-shell-contract';
import { cloneLayoutState } from './workbench-shell-state';
import type { NotificationSnapshot } from './notification-center';

type GridStructure = {
  template: GridTemplate;
  placements: Record<WorkbenchSurface, SurfacePlacement>;
};

export function createWorkbenchSnapshot(
  state: WorkbenchLayoutState,
  notifications: NotificationSnapshot
): WorkbenchSnapshot {
  const { template, placements } = computeWorkbenchGridStructure(state);
  return {
    ...cloneLayoutState(state),
    gridTemplate: template,
    placements,
    editorPlacements: computeEditorPlacements(state.editors.grid),
    notifications
  };
}

export function computeWorkbenchGridStructure(state: WorkbenchLayoutState): GridStructure {
  const columnSizes: string[] = [];
  const columnSurfaces: WorkbenchSurface[] = [];
  const pushColumn = (surface: WorkbenchSurface, size: string) => {
    columnSizes.push(size);
    columnSurfaces.push(surface);
  };

  pushColumn('activityBar', `${state.activityBar.width}px`);

  if (!state.sidebar.collapsed && state.sidebar.position === 'left') {
    pushColumn('primarySidebar', `${state.sidebar.size}px`);
  }
  if (!state.secondarySidebar.collapsed && state.secondarySidebar.position === 'left') {
    pushColumn('secondarySidebar', `${state.secondarySidebar.size}px`);
  }

  pushColumn('editor', '1fr');

  if (!state.sidebar.collapsed && state.sidebar.position === 'right') {
    pushColumn('primarySidebar', `${state.sidebar.size}px`);
  }
  if (!state.secondarySidebar.collapsed && state.secondarySidebar.position === 'right') {
    pushColumn('secondarySidebar', `${state.secondarySidebar.size}px`);
  }
  if (state.panel.visible && state.panel.position === 'right') {
    pushColumn('panel', `${state.panel.size}px`);
  }

  const columnPositions: Partial<Record<WorkbenchSurface, { start: number; end: number }>> = {};
  columnSurfaces.forEach((surface, index) => {
    columnPositions[surface] = { start: index + 1, end: index + 2 };
  });

  const rows = ['1fr'];
  const panelBottomVisible = state.panel.visible && state.panel.position === 'bottom';
  if (panelBottomVisible) {
    rows.push(`${state.panel.size}px`);
  }
  rows.push(`${state.statusBar.height}px`);

  const totalColumns = columnSizes.length || 1;
  const panelRowStart = panelBottomVisible ? 2 : null;
  const statusRowStart = panelBottomVisible ? 3 : 2;

  return {
    template: {
      columns: columnSizes.join(' '),
      rows: rows.join(' ')
    },
    placements: {
      activityBar: buildPlacement('activityBar', columnPositions.activityBar, {
        rowStart: 1,
        rowEnd: 2
      }),
      primarySidebar: buildPlacement('primarySidebar', columnPositions.primarySidebar, {
        rowStart: 1,
        rowEnd: 2,
        hidden: state.sidebar.collapsed
      }),
      secondarySidebar: buildPlacement('secondarySidebar', columnPositions.secondarySidebar, {
        rowStart: 1,
        rowEnd: 2,
        hidden: state.secondarySidebar.collapsed
      }),
      editor: buildPlacement('editor', columnPositions.editor, {
        rowStart: 1,
        rowEnd: 2
      }),
      panel: buildPlacement(
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
              hidden: !state.panel.visible
            }
      ),
      statusBar: buildPlacement('statusBar', undefined, {
        rowStart: statusRowStart,
        rowEnd: statusRowStart + 1,
        hidden: false,
        fallbackColumns: [1, totalColumns + 1]
      })
    }
  };
}

function buildPlacement(
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
