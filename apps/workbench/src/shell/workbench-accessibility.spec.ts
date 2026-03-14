import {
  buildWorkbenchLiveRegionMessage,
  createWorkbenchAccessibilityLabels,
  getNextRovingToolbarIndex,
  renderRovingToolbarButton
} from './workbench-accessibility';
import { I18nService, WORKBENCH_I18N_BUNDLES } from '../i18n/i18n-service';
import { createDefaultLayoutState } from './workbench-shell-state';
import type { WorkbenchSnapshot } from './workbench-shell-contract';

function createSnapshot(): WorkbenchSnapshot {
  const state = createDefaultLayoutState();
  state.sidebar.views = [{ id: 'view.explorer', title: 'Explorer', order: 1 }];
  state.sidebar.activeViewId = 'view.explorer';
  state.panel.views = [{ id: 'panel.terminal', title: 'Terminal', order: 1 }];
  state.panel.activeViewId = 'panel.terminal';

  return {
    ...state,
    gridTemplate: {
      columns: 'auto 1fr',
      rows: '1fr auto'
    },
    placements: {
      activityBar: { id: 'activityBar', columnStart: 1, columnEnd: 2, rowStart: 1, rowEnd: 2, hidden: false },
      primarySidebar: { id: 'primarySidebar', columnStart: 2, columnEnd: 3, rowStart: 1, rowEnd: 2, hidden: false },
      secondarySidebar: {
        id: 'secondarySidebar',
        columnStart: 3,
        columnEnd: 4,
        rowStart: 1,
        rowEnd: 2,
        hidden: true
      },
      editor: { id: 'editor', columnStart: 3, columnEnd: 4, rowStart: 1, rowEnd: 2, hidden: false },
      panel: { id: 'panel', columnStart: 1, columnEnd: 4, rowStart: 2, rowEnd: 3, hidden: false },
      statusBar: { id: 'statusBar', columnStart: 1, columnEnd: 4, rowStart: 3, rowEnd: 4, hidden: false }
    },
    editorPlacements: {},
    notifications: {
      items: [],
      unseenCount: 2,
      severityTally: {
        info: 0,
        success: 0,
        warning: 0,
        error: 0
      },
      locale: 'en-US'
    }
  };
}

describe('workbench accessibility helpers', () => {
  it('resolves localized labels for the workbench shell', () => {
    const i18n = new I18nService({
      locale: 'fr-FR',
      bundles: WORKBENCH_I18N_BUNDLES
    });

    const labels = createWorkbenchAccessibilityLabels(i18n);

    expect(labels.skipToEditor).toBe("Aller a l'editeur");
    expect(labels.statusBar).toBe("Barre d'etat de l'atelier");
  });

  it('computes roving focus targets for horizontal and vertical groups', () => {
    expect(getNextRovingToolbarIndex(0, 'ArrowRight', 4, 'horizontal')).toBe(1);
    expect(getNextRovingToolbarIndex(0, 'ArrowLeft', 4, 'horizontal')).toBe(3);
    expect(getNextRovingToolbarIndex(1, 'ArrowDown', 4, 'vertical')).toBe(2);
    expect(getNextRovingToolbarIndex(2, 'Home', 4, 'vertical')).toBe(0);
    expect(getNextRovingToolbarIndex(2, 'ArrowDown', 4, 'horizontal')).toBe(2);
  });

  it('renders toolbar buttons with focus and aria metadata', () => {
    const markup = renderRovingToolbarButton({
      action: 'activity',
      active: true,
      className: 'nexus-activity-item',
      label: 'Explorer',
      focusId: 'activity:explorer',
      icon: 'E',
      commandId: 'nexus.explorer.focus',
      data: {
        activityId: 'activity.explorer'
      },
      hideText: true,
      targetId: 'nexus-primary-sidebar-panel'
    });

    expect(markup).toContain('aria-label="Explorer"');
    expect(markup).toContain('aria-controls="nexus-primary-sidebar-panel"');
    expect(markup).toContain('data-focus-id="activity:explorer"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('nexus-sr-only');
  });

  it('builds a live-region summary from the active shell state', () => {
    const i18n = new I18nService({
      locale: 'en-US',
      bundles: WORKBENCH_I18N_BUNDLES
    });

    const message = buildWorkbenchLiveRegionMessage(createSnapshot(), i18n);

    expect(message).toBe('Active view Explorer. Panel Terminal. 2 Notifications.');
  });
});
