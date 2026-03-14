import type { I18nService } from '../i18n/i18n-service';
import type { WorkbenchSnapshot } from './workbench-shell-contract';

export type RovingToolbarOrientation = 'horizontal' | 'vertical';

export type WorkbenchAccessibilityLabels = {
  skipToEditor: string;
  activityBar: string;
  primarySidebar: string;
  secondarySidebar: string;
  editor: string;
  panel: string;
  statusBar: string;
  activitiesGroup: string;
  sidebarViewsGroup: string;
  panelViewsGroup: string;
  editorTabsGroup: string;
  hideSidebar: string;
  openSettings: string;
};

export type RovingToolbarButtonOptions = {
  action: string;
  active: boolean;
  className: string;
  label: string;
  focusId: string;
  icon?: string;
  commandId?: string;
  data?: Record<string, string | number | undefined>;
  hideText?: boolean;
  pressed?: boolean;
  roving?: boolean;
  targetId?: string;
  toggleable?: boolean;
};

export function createWorkbenchAccessibilityLabels(i18n: I18nService): WorkbenchAccessibilityLabels {
  return {
    skipToEditor: i18n.translate('accessibility.skip.editor', {
      fallback: 'Skip to editor'
    }),
    activityBar: i18n.translate('accessibility.landmark.activityBar', {
      fallback: 'Workbench activity bar'
    }),
    primarySidebar: i18n.translate('accessibility.landmark.primarySidebar', {
      fallback: 'Primary sidebar'
    }),
    secondarySidebar: i18n.translate('accessibility.landmark.secondarySidebar', {
      fallback: 'Secondary sidebar'
    }),
    editor: i18n.translate('accessibility.landmark.editor', {
      fallback: 'Editor area'
    }),
    panel: i18n.translate('accessibility.landmark.panel', {
      fallback: 'Workbench panel'
    }),
    statusBar: i18n.translate('accessibility.landmark.statusBar', {
      fallback: 'Workbench status bar'
    }),
    activitiesGroup: i18n.translate('accessibility.group.activities', {
      fallback: 'Workbench activities'
    }),
    sidebarViewsGroup: i18n.translate('accessibility.group.sidebarViews', {
      fallback: 'Sidebar views'
    }),
    panelViewsGroup: i18n.translate('accessibility.group.panelViews', {
      fallback: 'Panel views'
    }),
    editorTabsGroup: i18n.translate('accessibility.group.editorTabs', {
      fallback: 'Editor tabs'
    }),
    hideSidebar: i18n.translate('accessibility.action.hideSidebar', {
      fallback: 'Hide sidebar'
    }),
    openSettings: i18n.translate('accessibility.action.openSettings', {
      fallback: 'Open settings'
    })
  };
}

export function getNextRovingToolbarIndex(
  currentIndex: number,
  key: string,
  itemCount: number,
  orientation: RovingToolbarOrientation
) {
  if (itemCount <= 0 || currentIndex < 0 || currentIndex >= itemCount) {
    return currentIndex;
  }

  switch (key) {
    case 'Home':
      return 0;
    case 'End':
      return itemCount - 1;
    case 'ArrowLeft':
      return orientation === 'horizontal' ? wrapIndex(currentIndex - 1, itemCount) : currentIndex;
    case 'ArrowRight':
      return orientation === 'horizontal' ? wrapIndex(currentIndex + 1, itemCount) : currentIndex;
    case 'ArrowUp':
      return orientation === 'vertical' ? wrapIndex(currentIndex - 1, itemCount) : currentIndex;
    case 'ArrowDown':
      return orientation === 'vertical' ? wrapIndex(currentIndex + 1, itemCount) : currentIndex;
    default:
      return currentIndex;
  }
}

export function renderRovingToolbarButton(options: RovingToolbarButtonOptions) {
  const pressed = options.pressed ?? options.active;
  const roving = options.roving ?? true;
  const attributes = [
    `type="button"`,
    `class="${escapeAttribute(options.className)}${options.active ? ' is-active' : ''}"`,
    `data-action="${escapeAttribute(options.action)}"`,
    `data-focus-id="${escapeAttribute(options.focusId)}"`,
    `aria-label="${escapeAttribute(options.label)}"`,
    `tabindex="${roving ? (options.active ? '0' : '-1') : '0'}"`,
    `title="${escapeAttribute(options.label)}"`
  ];
  if (roving) {
    attributes.push(`data-roving-tab="true"`);
  }
  if (options.toggleable ?? true) {
    attributes.push(`aria-pressed="${pressed ? 'true' : 'false'}"`);
  }

  if (options.commandId) {
    attributes.push(`data-command-id="${escapeAttribute(options.commandId)}"`);
  }
  if (options.targetId) {
    attributes.push(`aria-controls="${escapeAttribute(options.targetId)}"`);
  }
  Object.entries(options.data ?? {}).forEach(([name, value]) => {
    if (value === undefined) {
      return;
    }
    attributes.push(`data-${escapeAttribute(toDataAttributeName(name))}="${escapeAttribute(String(value))}"`);
  });

  const content =
    options.hideText && options.icon
      ? `<span aria-hidden="true">${escapeText(options.icon)}</span><span class="nexus-sr-only">${escapeText(options.label)}</span>`
      : escapeText(options.label);

  return `<button ${attributes.join(' ')}>${content}</button>`;
}

export function buildWorkbenchLiveRegionMessage(snapshot: WorkbenchSnapshot, i18n: I18nService) {
  const activeView = snapshot.sidebar.views.find(view => view.id === snapshot.sidebar.activeViewId)?.title ?? 'Sidebar';
  const activePanel = snapshot.panel.views.find(view => view.id === snapshot.panel.activeViewId)?.title ?? 'Output';
  const notificationLabel = snapshot.notifications.unseenCount
    ? i18n.translate(
        snapshot.notifications.unseenCount === 1
          ? 'status.notifications.count.one'
          : 'status.notifications.count.other',
        {
          fallback:
            snapshot.notifications.unseenCount === 1 ? '{count} Notification' : '{count} Notifications',
          args: { count: snapshot.notifications.unseenCount }
        }
      )
    : i18n.translate('status.notifications.none', {
        fallback: '0 Notifications'
      });

  return i18n.translate('accessibility.liveRegion.summary', {
    fallback: 'Active view {view}. Panel {panel}. {notifications}.',
    args: {
      view: activeView,
      panel: activePanel,
      notifications: notificationLabel
    }
  });
}

function wrapIndex(index: number, itemCount: number) {
  return (index + itemCount) % itemCount;
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeText(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toDataAttributeName(value: string) {
  return value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
}
