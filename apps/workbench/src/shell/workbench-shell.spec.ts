import { WorkbenchShell, DEFAULT_ACTIVITY_ITEMS, type WorkbenchChangeReason } from './workbench-shell';
import { I18nService, WORKBENCH_I18N_BUNDLES } from '../i18n/i18n-service';

describe('WorkbenchShell', () => {
  it('registers activities and keeps them ordered', () => {
    const shell = new WorkbenchShell();
    [...DEFAULT_ACTIVITY_ITEMS].reverse().forEach(item => shell.registerActivity(item));
    const snapshot = shell.layoutSnapshot();
    const orderIds = snapshot.activityBar.items.map(item => item.id);
    expect(orderIds).toEqual(DEFAULT_ACTIVITY_ITEMS.map(item => item.id));
    expect(snapshot.activityBar.activeId).toBe(DEFAULT_ACTIVITY_ITEMS[0].id);
    expect(snapshot.placements.activityBar.hidden).toBe(false);
    expect(snapshot.placements.activityBar.columnStart).toBe(1);
  });

  it('clamps sidebar sizing and toggles panel visibility', () => {
    const shell = new WorkbenchShell();
    shell.setSidebarSize(800);
    shell.toggleSidebarCollapsed();
    shell.toggleSidebarCollapsed();
    shell.setPanelSize(50);
    shell.togglePanelVisibility(false);
    const snapshot = shell.layoutSnapshot();
    expect(snapshot.sidebar.size).toBeLessThanOrEqual(520);
    expect(snapshot.sidebar.collapsed).toBe(false);
    expect(snapshot.panel.size).toBeGreaterThanOrEqual(180);
    expect(snapshot.panel.visible).toBe(false);
  });

  it('opens editors and splits groups', () => {
    const shell = new WorkbenchShell();
    const first = shell.openEditor({ title: 'README.md', resource: 'workspace://README.md' });
    const secondId = shell.splitEditor('horizontal');
    shell.openEditor({ title: 'app.component.ts', resource: 'workspace://src/app.component.ts' }, secondId);
    const snapshot = shell.layoutSnapshot();
    expect(snapshot.editors.groups.length).toBe(2);
    expect(snapshot.editors.groups[0].tabs[0].id).toBe(first.id);
    expect(snapshot.editors.groups[1].tabs[0].title).toBe('app.component.ts');
    expect(snapshot.gridTemplate.columns).toContain('1fr');
    expect(snapshot.placements.editor.rowStart).toBe(1);
    expect(snapshot.placements.editor.rowEnd).toBe(2);
    const firstGroupId = snapshot.editors.groups[0].id;
    const secondGroupId = snapshot.editors.groups[1].id;
    expect(snapshot.editorPlacements[firstGroupId]?.height ?? 0).toBeGreaterThan(0);
    const firstPlacement = snapshot.editorPlacements[firstGroupId];
    const secondPlacement = snapshot.editorPlacements[secondGroupId];
    expect(firstPlacement?.height).toBeCloseTo(secondPlacement?.height ?? 0, 2);
  });

  it('moves tabs across groups and collapses empty groups', () => {
    const shell = new WorkbenchShell();
    const tab = shell.openEditor({ title: 'index.ts', resource: 'workspace://src/index.ts' });
    const otherTab = shell.openEditor({ title: 'feature.ts', resource: 'workspace://src/feature.ts' });
    const splitId = shell.splitEditor('vertical');
    shell.openEditor({ title: 'service.ts', resource: 'workspace://src/service.ts' }, splitId);
    expect(shell.moveEditorTab(tab.id, splitId, 0)).toBe(true);
    expect(shell.moveEditorTab(otherTab.id, splitId, 1)).toBe(true);
    let snapshot = shell.layoutSnapshot();
    expect(snapshot.editorPlacements[splitId].width).toBeLessThan(1);
    expect(snapshot.editors.groups.find(g => g.id === splitId)?.tabs.length).toBe(3);
    expect(shell.closeEditorGroup(splitId)).toBe(true);
    snapshot = shell.layoutSnapshot();
    expect(snapshot.editorPlacements[splitId]).toBeUndefined();
  });

  it('manages notification snapshots and status bar count', () => {
    const i18n = new I18nService({
      locale: 'en-US',
      bundles: WORKBENCH_I18N_BUNDLES
    });
    const shell = new WorkbenchShell(undefined, { i18n });
    let snapshot = shell.layoutSnapshot();
    expect(snapshot.notifications.unseenCount).toBe(0);
    const notifId = shell.pushNotification({
      title: 'Indexing complete',
      message: 'Workspace scan finished',
      severity: 'success',
      expiresInMs: 1000
    });
    snapshot = shell.layoutSnapshot();
    expect(snapshot.notifications.unseenCount).toBe(1);
    const statusEntry = snapshot.statusBar.items.find(item => item.id === 'status.notifications');
    expect(statusEntry?.text).toBeTruthy();
    i18n.setLocale('fr-FR');
    snapshot = shell.layoutSnapshot();
    const translatedEntry = snapshot.statusBar.items.find(item => item.id === 'status.notifications');
    expect(translatedEntry?.tooltip).toBe('Afficher les notifications en attente');
    shell.dismissNotification(notifId);
    snapshot = shell.layoutSnapshot();
    expect(snapshot.notifications.unseenCount).toBe(0);
  });

  it('emits layout changes and updates placements for panel modes', () => {
    const shell = new WorkbenchShell();
    const reasons: WorkbenchChangeReason[] = [];
    const unsubscribe = shell.onLayoutChange((_snapshot, reason) => reasons.push(reason));
    shell.setPanelPosition('right');
    shell.setPanelSize(420);
    const snapshotRight = shell.layoutSnapshot();
    expect(snapshotRight.placements.panel.hidden).toBe(false);
    expect(snapshotRight.placements.panel.columnStart).toBeGreaterThan(1);
    shell.setPanelPosition('bottom');
    const snapshotBottom = shell.layoutSnapshot();
    expect(snapshotBottom.placements.panel.rowStart).toBe(2);
    expect(snapshotBottom.placements.panel.columnStart).toBe(1);
    expect(reasons).toContain('panel');
    unsubscribe();
  });

  it('sets active sidebar/panel views and editors by resource', () => {
    const shell = new WorkbenchShell();
    shell.registerSidebarView({ id: 'view.tests', title: 'Tests', order: 4 });
    expect(shell.setActiveSidebarView('view.tests')).toBe(true);
    shell.registerPanelView({ id: 'panel.logs', title: 'Logs', order: 3 });
    expect(shell.setActivePanelView('panel.logs')).toBe(true);
    const tabA = shell.openEditor({ title: 'a.ts', resource: 'workspace://a.ts' });
    shell.openEditor({ title: 'b.ts', resource: 'workspace://b.ts' });
    expect(shell.setActiveEditorByResource('workspace://a.ts')).toBe(true);
    const snapshot = shell.layoutSnapshot();
    const activeGroup = snapshot.editors.groups.find(group => group.id === snapshot.editors.activeGroupId);
    expect(activeGroup?.activeTabId).toBe(tabA.id);
    expect(snapshot.sidebar.activeViewId).toBe('view.tests');
    expect(snapshot.panel.activeViewId).toBe('panel.logs');
  });

  it('unregisters panel views and reassigns the active panel when needed', () => {
    const shell = new WorkbenchShell();
    shell.registerPanelView({ id: 'panel.output', title: 'Output', order: 1 });
    shell.registerPanelView({ id: 'panel.problems', title: 'Problems', order: 2 });
    shell.setActivePanelView('panel.problems');

    expect(shell.unregisterPanelView('panel.problems')).toBe(true);
    expect(shell.unregisterPanelView('panel.unknown')).toBe(false);

    const snapshot = shell.layoutSnapshot();
    expect(snapshot.panel.views.some(view => view.id === 'panel.problems')).toBe(false);
    expect(snapshot.panel.activeViewId).toBe('panel.output');
  });
});
