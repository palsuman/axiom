import { createInitialGrid } from './editor-dock-grid';
import { computeWorkbenchGridStructure } from './workbench-shell-layout';
import { createDefaultLayoutState } from './workbench-shell-state';

describe('computeWorkbenchGridStructure', () => {
  it('places bottom panel across the full shell width above the status bar', () => {
    const state = createDefaultLayoutState();
    const layout = computeWorkbenchGridStructure(state);

    expect(layout.placements.panel.hidden).toBe(false);
    expect(layout.placements.panel.columnStart).toBe(1);
    expect(layout.placements.panel.rowStart).toBe(2);
    expect(layout.placements.statusBar.rowStart).toBe(3);
  });

  it('allocates a right panel as its own column and hides collapsed sidebars', () => {
    const state = createDefaultLayoutState();
    state.sidebar.collapsed = true;
    state.secondarySidebar.collapsed = true;
    state.panel.position = 'right';
    state.panel.visible = true;
    state.panel.size = 420;
    state.editors.grid = createInitialGrid('group-1');

    const layout = computeWorkbenchGridStructure(state);

    expect(layout.template.columns).toContain('420px');
    expect(layout.placements.primarySidebar.hidden).toBe(true);
    expect(layout.placements.secondarySidebar.hidden).toBe(true);
    expect(layout.placements.panel.columnStart).toBeGreaterThan(layout.placements.editor.columnStart);
    expect(layout.placements.statusBar.columnStart).toBe(1);
  });
});
