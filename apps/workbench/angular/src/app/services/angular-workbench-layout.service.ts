import { Injectable, signal } from '@angular/core';
import type { ThemeRuntimeSnapshot } from '@nexus/platform/theming/theme-runtime';
import {
  WORKBENCH_I18N_BUNDLES,
  WORKBENCH_SUPPORTED_LOCALES,
  type LocalizedText,
  I18nService
} from '../../../../src/i18n/i18n-service';
import { createWorkbenchSnapshot } from '../../../../src/shell/workbench-shell-layout';
import {
  createDefaultLayoutState,
  type ActivityRegistration,
  type StatusBarItemRegistration
} from '../../../../src/shell/workbench-shell';
import type { PanelPosition, WorkbenchLayoutState, WorkbenchSnapshot } from '../../../../src/shell/workbench-shell-contract';
import { NotificationCenter } from '../../../../src/shell/notification-center';
import { AngularThemeHostService } from './angular-theme-host.service';

type ShellMetadata = {
  env: string;
  platform: string;
  bridgeAvailable: boolean;
};

const DEFAULT_METADATA: ShellMetadata = {
  env: 'unknown',
  platform: 'unknown',
  bridgeAvailable: false
};

@Injectable({ providedIn: 'root' })
export class AngularWorkbenchLayoutService {
  readonly snapshot = signal<WorkbenchSnapshot>(createWorkbenchSnapshot(createDefaultLayoutState(), emptyNotifications()));
  readonly locale = signal<string>('en-US');
  readonly supportedLocales = signal<readonly string[]>(WORKBENCH_SUPPORTED_LOCALES);
  readonly metadata = signal<ShellMetadata>(DEFAULT_METADATA);

  private readonly i18n: I18nService;
  private readonly notificationCenter: NotificationCenter;
  private readonly state: WorkbenchLayoutState;

  constructor(private readonly themeHost: AngularThemeHostService) {
    this.i18n = new I18nService({
      locale: 'en-US',
      bundles: WORKBENCH_I18N_BUNDLES
    });
    this.notificationCenter = new NotificationCenter({ i18n: this.i18n });
    this.state = createDefaultLayoutState();

    this.themeHost.getThemeRuntime().onDidChange(event => {
      this.applyThemeSnapshot(event.snapshot);
    });
    this.i18n.onDidChangeLocale(locale => {
      this.locale.set(locale);
      this.rebuildShell();
    });
    this.notificationCenter.onDidChange(() => {
      this.emitSnapshot();
    });
  }

  initialize(metadata: Partial<ShellMetadata> = {}) {
    this.metadata.set({
      ...DEFAULT_METADATA,
      ...metadata
    });
    this.supportedLocales.set(this.i18n.getSupportedLocales());
    this.applyThemeSnapshot(this.themeHost.getThemeRuntime().getSnapshot());
    this.seedShell();
  }

  cycleLocale() {
    const locales = this.i18n.getSupportedLocales();
    const currentIndex = locales.indexOf(this.i18n.getLocale());
    const nextLocale = locales[(currentIndex + 1 + locales.length) % locales.length] ?? 'en-US';
    this.setLocale(nextLocale);
  }

  setLocale(locale: string) {
    const changed = this.i18n.setLocale(locale);
    if (!changed) {
      return false;
    }
    this.notificationCenter.push({
      severity: 'success',
      title: localized('notification.locale.updated.title', 'Display language updated'),
      message: localized('notification.locale.updated.message', 'Nexus now uses {locale}.', {
        locale: this.i18n.getLocaleDisplayName(locale)
      }),
      expiresInMs: 2000
    });
    return true;
  }

  activateActivity(activityId: string) {
    this.state.activityBar.activeId = activityId;
    if (activityId === 'activity.chat') {
      this.state.secondarySidebar.collapsed = false;
      this.state.secondarySidebar.activeViewId = 'view.notifications';
    }
    this.emitSnapshot();
  }

  activateSidebarView(viewId: string, target: 'primary' | 'secondary' = 'primary') {
    const bucket = target === 'primary' ? this.state.sidebar : this.state.secondarySidebar;
    bucket.collapsed = false;
    bucket.activeViewId = viewId;
    this.emitSnapshot();
  }

  togglePrimarySidebar() {
    this.state.sidebar.collapsed = !this.state.sidebar.collapsed;
    this.emitSnapshot();
  }

  toggleSecondarySidebar(force?: boolean) {
    this.state.secondarySidebar.collapsed = typeof force === 'boolean' ? !force : !this.state.secondarySidebar.collapsed;
    this.emitSnapshot();
  }

  setPanelPosition(position: PanelPosition) {
    this.state.panel.position = position;
    this.state.panel.visible = true;
    this.emitSnapshot();
  }

  togglePanelVisibility(force?: boolean) {
    this.state.panel.visible = typeof force === 'boolean' ? force : !this.state.panel.visible;
    this.emitSnapshot();
  }

  activatePanelView(viewId: string) {
    this.state.panel.visible = true;
    this.state.panel.activeViewId = viewId;
    this.emitSnapshot();
  }

  focusEditor(resource: string) {
    const group = this.state.editors.groups.find(entry => entry.id === this.state.editors.activeGroupId) ?? this.state.editors.groups[0];
    if (!group) {
      return;
    }
    const tab = group.tabs.find(entry => entry.resource === resource);
    if (!tab) {
      return;
    }
    group.activeTabId = tab.id;
    this.emitSnapshot();
  }

  openSettings() {
    const group = this.state.editors.groups[0];
    if (!group.tabs.some(tab => tab.resource === 'nexus://settings')) {
      group.tabs.push({
        id: 'editor-settings',
        title: this.i18n.translate('accessibility.action.openSettings', { fallback: 'Open settings' }),
        resource: 'nexus://settings',
        kind: 'text'
      });
    }
    group.activeTabId = 'editor-settings';
    this.emitSnapshot();
  }

  private seedShell() {
    this.state.activityBar.items = buildActivities(this.i18n);
    this.state.activityBar.activeId = this.state.activityBar.items[0]?.id;

    this.state.sidebar.views = [
      { id: 'view.explorer', title: this.i18n.translate('activity.explorer', { fallback: 'Explorer' }), order: 1, icon: 'icon.codicon.folder' },
      { id: 'view.search', title: this.i18n.translate('activity.search', { fallback: 'Search' }), order: 2, icon: 'icon.codicon.search' },
      { id: 'view.git', title: this.i18n.translate('activity.git', { fallback: 'Source Control' }), order: 3, icon: 'icon.codicon.debug' },
      { id: 'view.run', title: this.i18n.translate('activity.run', { fallback: 'Run & Debug' }), order: 4, icon: 'icon.codicon.run' },
      { id: 'view.extensions', title: this.i18n.translate('activity.extensions', { fallback: 'Extensions' }), order: 5, icon: 'icon.codicon.settings' }
    ];
    this.state.sidebar.activeViewId = this.state.sidebar.views[0]?.id;

    this.state.secondarySidebar.views = [
      {
        id: 'view.notifications',
        title: this.i18n.translate('command.notifications.show', { fallback: 'Notifications' }),
        order: 1,
        icon: 'icon.codicon.ai'
      }
    ];
    this.state.secondarySidebar.activeViewId = 'view.notifications';

    this.state.panel.views = [
      { id: 'panel.terminal', title: this.i18n.translate('panel.terminal', { fallback: 'Terminal' }), order: 1 },
      { id: 'panel.output', title: this.i18n.translate('panel.output', { fallback: 'Output' }), order: 2 },
      { id: 'panel.problems', title: this.i18n.translate('panel.problems', { fallback: 'Problems' }), order: 3 }
    ];
    this.state.panel.activeViewId = 'panel.terminal';
    this.state.panel.visible = true;

    this.state.editors.groups = [
      {
        id: 'group-1',
        activeTabId: 'editor-readme',
        tabs: [
          {
            id: 'editor-readme',
            title: 'README.md',
            resource: 'README.md',
            kind: 'text'
          },
          {
            id: 'editor-launch',
            title: 'launch.json',
            resource: '.vscode/launch.json',
            kind: 'text'
          }
        ]
      }
    ];
    this.state.editors.activeGroupId = 'group-1';

    this.rebuildShell();
  }

  private rebuildShell() {
    this.state.statusBar.items = buildStatusItems(this.i18n, this.themeHost.theme(), this.notificationCenter.getSnapshot().unseenCount);
    this.state.tokens = { ...this.themeHost.getThemeRuntime().getSnapshot().cssVariables };
    this.emitSnapshot();
  }

  private emitSnapshot() {
    this.snapshot.set(createWorkbenchSnapshot(this.state, this.notificationCenter.getSnapshot()));
  }

  private applyThemeSnapshot(snapshot: ThemeRuntimeSnapshot) {
    this.state.tokens = { ...snapshot.cssVariables };
    this.emitSnapshot();
  }
}

function buildActivities(i18n: I18nService): ActivityRegistration[] {
  return [
    { id: 'activity.explorer', title: i18n.translate('activity.explorer', { fallback: 'Explorer' }), icon: 'folder-opened', order: 1, commandId: 'nexus.explorer.focus' },
    { id: 'activity.search', title: i18n.translate('activity.search', { fallback: 'Search' }), icon: 'search', order: 2, commandId: 'nexus.search.focus' },
    { id: 'activity.git', title: i18n.translate('activity.git', { fallback: 'Source Control' }), icon: 'git-branch', order: 3, commandId: 'nexus.git.focus' },
    { id: 'activity.run', title: i18n.translate('activity.run', { fallback: 'Run & Debug' }), icon: 'debug-alt', order: 4, commandId: 'nexus.run.focus' },
    { id: 'activity.extensions', title: i18n.translate('activity.extensions', { fallback: 'Extensions' }), icon: 'extensions', order: 5, commandId: 'nexus.extensions.focus' },
    { id: 'activity.chat', title: i18n.translate('activity.chat', { fallback: 'AI' }), icon: 'sparkle', order: 6, commandId: 'nexus.ai.chat' }
  ];
}

function buildStatusItems(i18n: I18nService, activeThemeId: string, unseenCount: number): StatusBarItemRegistration[] {
  return [
    {
      id: 'status.locale',
      alignment: 'left',
      text: localized('status.locale.current', 'Language: {locale}', {
        locale: i18n.getLocaleDisplayName(i18n.getLocale())
      }),
      priority: 50
    },
    {
      id: 'status.theme',
      alignment: 'left',
      text: `Theme: ${activeThemeId}`,
      priority: 40
    },
    {
      id: 'status.notifications',
      alignment: 'right',
      text:
        unseenCount === 0
          ? localized('status.notifications.none', '0 Notifications')
          : localized(
              unseenCount === 1 ? 'status.notifications.count.one' : 'status.notifications.count.other',
              unseenCount === 1 ? '{count} Notification' : '{count} Notifications',
              { count: unseenCount }
            ),
      priority: 30
    },
    {
      id: 'status.settings',
      alignment: 'right',
      text: localized('accessibility.action.openSettings', 'Open settings'),
      priority: 20
    }
  ];
}

function localized(key: string, fallback: string, args?: Record<string, string | number>): LocalizedText {
  return { key, fallback, args };
}

function emptyNotifications() {
  return {
    items: [],
    unseenCount: 0,
    severityTally: {
      info: 0,
      success: 0,
      warning: 0,
      error: 0
    },
    locale: 'en-US'
  };
}
