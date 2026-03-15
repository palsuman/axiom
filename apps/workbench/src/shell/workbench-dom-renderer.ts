import type { SettingsScope } from '@nexus/platform/settings/settings-registry';
import { createRequire } from 'node:module';
import type { WorkbenchShell, WorkbenchSnapshot } from './workbench-shell';
import type { CommandRegistry } from '../commands/command-registry';
import type { GitStatusStore } from '../scm/git-status-store';
import type { GitCommitStore } from '../scm/git-commit-store';
import type { GitHistoryStore } from '../scm/git-history-store';
import type { SettingsEditorService } from '../settings/settings-editor-service';
import type {
  LaunchConfigurationEditorService,
  LaunchConfigurationEditorSnapshot
} from '../run-debug/launch-configuration-editor-service';
import type { PrivacyCenterService } from '../observability/privacy-center-service';
import type { DebugSessionStore } from '../run-debug/debug-session-store';
import type { I18nService } from '../i18n/i18n-service';
import {
  buildWorkbenchLiveRegionMessage,
  createWorkbenchAccessibilityLabels,
  getNextRovingToolbarIndex,
  renderRovingToolbarButton,
  type WorkbenchAccessibilityLabels
} from './workbench-accessibility';

type BootstrapModule = typeof import('../boot/bootstrap-workbench');
const loadModule = createRequire(__filename);

type MountHandle = {
  dispose: () => void;
};

type RendererElements = {
  host: HTMLElement;
  announcer: HTMLElement;
  activityBar: HTMLElement;
  sidebar: HTMLElement;
  secondarySidebar: HTMLElement;
  editor: HTMLElement;
  panel: HTMLElement;
  panelTabs: HTMLElement;
  panelBody: HTMLElement;
  terminalHost: HTMLElement;
  statusBar: HTMLElement;
};

export function mountWorkbenchDom(container: HTMLElement = document.body): MountHandle {
  const bootstrap = loadModule('../boot/bootstrap-workbench') as BootstrapModule;
  const elements = ensureWorkbenchDom(container);
  const {
    shell,
    commandRegistry,
    gitStatusStore,
    gitCommitStore,
    gitHistoryStore,
    debugSessionStore,
    settingsEditorService,
    privacyCenterService,
    launchConfigurationEditorService,
    i18nService
  } = bootstrap;

  const render = () => {
    const focusId = captureFocusedElementId(elements.host);
    const snapshot = shell.layoutSnapshot();
    const labels = createWorkbenchAccessibilityLabels(i18nService);
    renderLayout(elements, snapshot);
    renderActivityBar(elements.activityBar, snapshot, commandRegistry, labels);
    renderSidebar(
      elements.sidebar,
      snapshot,
      commandRegistry,
      gitStatusStore,
      gitCommitStore,
      gitHistoryStore,
      launchConfigurationEditorService,
      debugSessionStore,
      labels
    );
    renderSecondarySidebar(elements.secondarySidebar, snapshot, labels);
    renderEditors(
      elements.editor,
      snapshot,
      settingsEditorService,
      privacyCenterService,
      launchConfigurationEditorService,
      debugSessionStore,
      commandRegistry,
      labels
    );
    renderPanel(elements, snapshot, labels);
    renderStatusBar(elements.statusBar, snapshot, commandRegistry, i18nService, labels);
    elements.announcer.textContent = buildWorkbenchLiveRegionMessage(snapshot, i18nService);
    restoreFocusedElement(elements.host, focusId);
  };

  const disposers = [
    shell.onLayoutChange(() => render()),
    gitStatusStore.onDidChange(() => render()),
    gitCommitStore.onDidChange(() => render()),
    gitHistoryStore.onDidChange(() => render()),
    debugSessionStore.onDidChange(() => render()),
    settingsEditorService.onDidChange(() => render()),
    privacyCenterService.onDidChange(() => render()),
    launchConfigurationEditorService.onDidChange(() => render()),
    i18nService.onDidChangeLocale(() => render())
  ];

  bindWorkbenchEvents(
    elements.host,
    shell,
    commandRegistry,
    settingsEditorService,
    privacyCenterService,
    launchConfigurationEditorService,
    gitStatusStore,
    debugSessionStore
  );
  render();

  return {
    dispose: () => {
      disposers.forEach(dispose => dispose());
    }
  };
}

function ensureWorkbenchDom(container: HTMLElement): RendererElements {
  injectWorkbenchStyles();
  let host = container.querySelector<HTMLElement>('#nexus-workbench-app');
  if (!host) {
    host = document.createElement('div');
    host.id = 'nexus-workbench-app';
    host.innerHTML = `
      <a
        href="#nexus-editor-main"
        class="nexus-skip-link"
        data-action="skip-to"
        data-focus-target="#nexus-editor-main"
      >
        Skip to editor
      </a>
      <div class="nexus-sr-only" aria-live="polite" aria-atomic="true" data-workbench-announcer="true"></div>
      <section class="nexus-surface nexus-activity-bar" data-surface="activityBar"></section>
      <section class="nexus-surface nexus-sidebar" data-surface="primarySidebar"></section>
      <section class="nexus-surface nexus-secondary-sidebar" data-surface="secondarySidebar"></section>
      <main class="nexus-surface nexus-editor" data-surface="editor" id="nexus-editor-main" tabindex="-1"></main>
      <section class="nexus-surface nexus-panel" data-surface="panel">
        <div class="nexus-panel-tabs"></div>
        <div class="nexus-panel-body"></div>
      </section>
      <footer class="nexus-surface nexus-status-bar" data-surface="statusBar"></footer>
    `;
    container.appendChild(host);
  }
  document.body.classList.add('nexus-mounted');

  const panelBody = host.querySelector<HTMLElement>('.nexus-panel-body');
  if (!panelBody) {
    throw new Error('Workbench panel body is missing');
  }

  let terminalHost = panelBody.querySelector<HTMLElement>('#nexus-terminal-host');
  if (!terminalHost) {
    terminalHost = document.createElement('div');
    terminalHost.id = 'nexus-terminal-host';
    terminalHost.className = 'nexus-terminal-host';
    panelBody.appendChild(terminalHost);
  }

  return {
    host,
    announcer: requireElement(host, '[data-workbench-announcer="true"]'),
    activityBar: requireElement(host, '[data-surface="activityBar"]'),
    sidebar: requireElement(host, '[data-surface="primarySidebar"]'),
    secondarySidebar: requireElement(host, '[data-surface="secondarySidebar"]'),
    editor: requireElement(host, '[data-surface="editor"]'),
    panel: requireElement(host, '[data-surface="panel"]'),
    panelTabs: requireElement(host, '.nexus-panel-tabs'),
    panelBody,
    terminalHost,
    statusBar: requireElement(host, '[data-surface="statusBar"]')
  };
}

function bindWorkbenchEvents(
  host: HTMLElement,
  shell: WorkbenchShell,
  commandRegistry: CommandRegistry,
  settingsEditorService: SettingsEditorService,
  privacyCenterService: PrivacyCenterService,
  launchConfigurationEditorService: LaunchConfigurationEditorService,
  gitStatusStore: GitStatusStore,
  debugSessionStore: DebugSessionStore
) {
  if (host.dataset.eventsBound === 'true') {
    return;
  }
  host.dataset.eventsBound = 'true';

  host.addEventListener('click', event => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]');
    if (!target) {
      return;
    }
    const action = target.dataset.action;
    switch (action) {
      case 'skip-to':
        event.preventDefault();
        if (target.dataset.focusTarget) {
          host.querySelector<HTMLElement>(target.dataset.focusTarget)?.focus();
        }
        break;
      case 'activity':
        if (target.dataset.activityId) {
          shell.activateActivity(target.dataset.activityId);
          if (target.dataset.commandId && commandRegistry.get(target.dataset.commandId)) {
            void commandRegistry.executeCommand(target.dataset.commandId);
          }
        }
        break;
      case 'sidebar-view':
        if (target.dataset.viewId) {
          shell.setActiveSidebarView(target.dataset.viewId);
        }
        break;
      case 'panel-view':
        if (target.dataset.viewId) {
          shell.setActivePanelView(target.dataset.viewId);
        }
        break;
      case 'editor-tab':
        if (target.dataset.resource) {
          shell.setActiveEditorByResource(target.dataset.resource);
        }
        break;
      case 'command':
        if (target.dataset.commandId) {
          const args = parseDatasetJson(target.dataset.commandArgs);
          void commandRegistry.executeCommand(target.dataset.commandId, args);
        }
        break;
      case 'settings-open':
        void commandRegistry.executeCommand('nexus.settings.open', {
          scope: target.dataset.scope,
          mode: target.dataset.mode,
          focusKey: target.dataset.focusKey
        });
        break;
      case 'settings-scope':
        settingsEditorService.open({
          scope: target.dataset.scope as SettingsScope,
          mode: target.dataset.mode === 'json' ? 'json' : 'form'
        });
        break;
      case 'settings-mode':
        settingsEditorService.open({
          scope: target.dataset.scope as SettingsScope,
          mode: target.dataset.mode === 'json' ? 'json' : 'form'
        });
        break;
      case 'privacy-open':
        void privacyCenterService.open();
        break;
      case 'settings-reset':
        if (target.dataset.key && target.dataset.scope) {
          settingsEditorService.resetSetting(target.dataset.key, target.dataset.scope as SettingsScope);
        }
        break;
      case 'git-select':
        if (target.dataset.path && target.dataset.location) {
          void gitStatusStore.selectEntry(
            target.dataset.path,
            target.dataset.location as 'staged' | 'working'
          );
        }
        break;
      case 'git-stage-all':
        void commandRegistry.executeCommand('nexus.git.stageAll');
        break;
      case 'git-unstage-all':
        void commandRegistry.executeCommand('nexus.git.unstageAll');
        break;
      case 'git-refresh':
        void commandRegistry.executeCommand('nexus.git.refreshStatus');
        break;
      case 'git-commit':
        void commandRegistry.executeCommand('nexus.git.commit');
        break;
      case 'settings-apply-json': {
        const textarea = host.querySelector<HTMLTextAreaElement>('[data-settings-json]');
        if (textarea && textarea.dataset.scope) {
          settingsEditorService.updateJsonText(textarea.value, textarea.dataset.scope as SettingsScope);
        }
        break;
      }
      case 'run-config-open':
        void commandRegistry.executeCommand('nexus.run.configurations.open', {
          mode: target.dataset.mode === 'json' ? 'json' : 'form'
        });
        break;
      case 'run-config-mode':
        void launchConfigurationEditorService.setMode(target.dataset.mode === 'json' ? 'json' : 'form');
        break;
      case 'run-config-add':
        void launchConfigurationEditorService.addConfiguration(
          target.dataset.template === 'node-attach' ? 'node-attach' : 'node-launch'
        );
        break;
      case 'run-config-remove':
        if (target.dataset.index) {
          void launchConfigurationEditorService.removeConfiguration(Number(target.dataset.index));
        }
        break;
      case 'run-config-refresh':
        void launchConfigurationEditorService.refresh();
        break;
      case 'run-debug-start':
        void commandRegistry.executeCommand('nexus.run.debug.start');
        break;
      case 'run-debug-stop':
        void commandRegistry.executeCommand('nexus.run.debug.stop');
        break;
      case 'privacy-refresh':
        void privacyCenterService.refresh();
        break;
      case 'privacy-export':
        void privacyCenterService.exportData(target.dataset.mode === 'workspace' ? 'workspace' : 'all');
        break;
      case 'privacy-delete':
        void privacyCenterService.deleteData(target.dataset.deleteExports !== 'false');
        break;
      case 'privacy-consent-apply': {
        const scope = target.dataset.scope === 'workspace' ? 'workspace' : 'user';
        const usageInput = host.querySelector<HTMLInputElement>(`[data-privacy-usage="${scope}"]`);
        const crashInput = host.querySelector<HTMLInputElement>(`[data-privacy-crash="${scope}"]`);
        if (usageInput && crashInput) {
          void privacyCenterService.updateConsent(scope, {
            usageTelemetry: usageInput.checked,
            crashReports: crashInput.checked
          });
        }
        break;
      }
      case 'run-debug-frame-select':
        debugSessionStore.selectStackFrame(
          target.dataset.frameId ? Number(target.dataset.frameId) : undefined
        );
        break;
      case 'debug-breakpoint-add': {
        const sourceInput = host.querySelector<HTMLInputElement>('[data-debug-breakpoint-source]');
        const lineInput = host.querySelector<HTMLInputElement>('[data-debug-breakpoint-line]');
        if (sourceInput?.value.trim() && lineInput?.value.trim()) {
          debugSessionStore.addBreakpoint(sourceInput.value, Number(lineInput.value));
          lineInput.value = '';
        }
        break;
      }
      case 'debug-breakpoint-toggle':
        if (target.dataset.breakpointId) {
          debugSessionStore.toggleBreakpoint(target.dataset.breakpointId);
        }
        break;
      case 'debug-breakpoint-remove':
        if (target.dataset.breakpointId) {
          debugSessionStore.removeBreakpoint(target.dataset.breakpointId);
        }
        break;
      case 'debug-breakpoint-toggle-line':
        if (target.dataset.source && target.dataset.line) {
          debugSessionStore.toggleBreakpointAtLocation(target.dataset.source, Number(target.dataset.line));
        }
        break;
      case 'debug-watch-add': {
        const watchInput = host.querySelector<HTMLInputElement>('[data-debug-watch-expression]');
        if (watchInput?.value.trim()) {
          debugSessionStore.addWatchExpression(watchInput.value);
          watchInput.value = '';
        }
        break;
      }
      case 'debug-watch-apply':
        if (target.dataset.watchId) {
          const watchInput = host.querySelector<HTMLInputElement>(`[data-debug-watch-id="${target.dataset.watchId}"]`);
          if (watchInput?.value.trim()) {
            debugSessionStore.updateWatchExpression(target.dataset.watchId, watchInput.value);
          }
        }
        break;
      case 'debug-watch-remove':
        if (target.dataset.watchId) {
          debugSessionStore.removeWatchExpression(target.dataset.watchId);
        }
        break;
      case 'run-config-apply-json': {
        const textarea = host.querySelector<HTMLTextAreaElement>('[data-run-config-json]');
        if (textarea) {
          launchConfigurationEditorService.updateJsonText(textarea.value);
          void launchConfigurationEditorService.applyJsonText();
        }
        break;
      }
      default:
        break;
    }
  });

  host.addEventListener('change', event => {
    const target = event.target as HTMLElement | null;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
      return;
    }
    if (target.dataset.runConfigIndex && target.dataset.runConfigField) {
      void launchConfigurationEditorService.updateConfigurationField(
        Number(target.dataset.runConfigIndex),
        target.dataset.runConfigField,
        readControlValue(target)
      );
      return;
    }
    if (target.dataset.settingKey && target.dataset.settingScope) {
      settingsEditorService.updateSetting(
        target.dataset.settingKey,
        readControlValue(target),
        target.dataset.settingScope as SettingsScope
      );
      return;
    }
    if (target.dataset.gitCommitMessage === 'true') {
      void commandRegistry.executeCommand('nexus.git.setCommitMessage', { message: target.value });
    }
  });

  host.addEventListener('input', event => {
    const target = event.target as HTMLElement | null;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return;
    }
    if (target.dataset.settingsQuery === 'true') {
      settingsEditorService.setQuery(target.value);
      return;
    }
    if (target.dataset.runConfigJson === 'true') {
      launchConfigurationEditorService.updateJsonText(target.value);
    }
  });

  host.addEventListener('keydown', event => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-roving-tab="true"]');
    if (!target) {
      return;
    }

    const tablist = target.closest<HTMLElement>('[data-tablist="true"]');
    if (!tablist) {
      return;
    }

    const items = Array.from(tablist.querySelectorAll<HTMLElement>('[data-roving-tab="true"]')).filter(
      entry => !entry.hasAttribute('disabled')
    );
    const currentIndex = items.indexOf(target);
    const orientation = tablist.dataset.tablistOrientation === 'vertical' ? 'vertical' : 'horizontal';
    const nextIndex = getNextRovingToolbarIndex(currentIndex, event.key, items.length, orientation);

    if (nextIndex === currentIndex || nextIndex < 0 || nextIndex >= items.length) {
      return;
    }

    event.preventDefault();
    items[nextIndex]?.focus();
    items[nextIndex]?.click();
  });
}

function renderLayout(elements: RendererElements, snapshot: WorkbenchSnapshot) {
  elements.host.style.gridTemplateColumns = snapshot.gridTemplate.columns;
  elements.host.style.gridTemplateRows = snapshot.gridTemplate.rows;

  applyPlacement(elements.activityBar, snapshot.placements.activityBar);
  applyPlacement(elements.sidebar, snapshot.placements.primarySidebar);
  applyPlacement(elements.secondarySidebar, snapshot.placements.secondarySidebar);
  applyPlacement(elements.editor, snapshot.placements.editor);
  applyPlacement(elements.panel, snapshot.placements.panel);
  applyPlacement(elements.statusBar, snapshot.placements.statusBar);
}

function renderActivityBar(
  activityBar: HTMLElement,
  snapshot: WorkbenchSnapshot,
  commandRegistry: CommandRegistry,
  labels: WorkbenchAccessibilityLabels
) {
  activityBar.setAttribute('aria-label', labels.activityBar);
  const skipLink = activityBar.parentElement?.querySelector<HTMLElement>('.nexus-skip-link');
  if (skipLink) {
    skipLink.textContent = labels.skipToEditor;
  }
  activityBar.innerHTML = `
    <nav class="nexus-activity-nav" aria-label="${escapeHtml(labels.activityBar)}">
    <div class="nexus-brand" aria-hidden="true">N</div>
    <div
      class="nexus-activity-items"
      role="toolbar"
      aria-label="${escapeHtml(labels.activitiesGroup)}"
      data-tablist="true"
      data-tablist-orientation="vertical"
    >
      ${snapshot.activityBar.items
        .map(
          item =>
            renderRovingToolbarButton({
              action: 'activity',
              active: snapshot.activityBar.activeId === item.id,
              className: 'nexus-activity-item',
              label: item.title,
              focusId: `activity:${item.id}`,
              icon: item.icon ?? item.title.slice(0, 1),
              commandId: item.commandId,
              data: {
                activityId: item.id
              },
              hideText: true,
              targetId: 'nexus-primary-sidebar-panel'
            })
        )
        .join('')}
    </div>
    <div class="nexus-activity-footer">
      ${renderRovingToolbarButton({
        action: 'command',
        active: false,
        className: 'nexus-activity-item',
        label: labels.openSettings,
        focusId: 'activity:settings',
        icon: 'S',
        commandId: 'nexus.settings.open',
        hideText: true,
        roving: false,
        toggleable: false
      })}
    </div>
    </nav>
  `;
  void commandRegistry;
}

function renderSidebar(
  sidebar: HTMLElement,
  snapshot: WorkbenchSnapshot,
  commandRegistry: CommandRegistry,
  gitStatusStore: GitStatusStore,
  gitCommitStore: GitCommitStore,
  gitHistoryStore: GitHistoryStore,
  launchConfigurationEditorService: LaunchConfigurationEditorService,
  debugSessionStore: DebugSessionStore,
  labels: WorkbenchAccessibilityLabels
) {
  const activeViewId = snapshot.sidebar.activeViewId;
  sidebar.setAttribute('aria-label', labels.primarySidebar);
  sidebar.innerHTML = `
    <header class="nexus-section-header" id="nexus-primary-sidebar-title">
      <div class="nexus-section-title">${escapeHtml(resolveActiveSidebarTitle(snapshot))}</div>
      <button
        type="button"
        class="nexus-ghost-button"
        data-action="command"
        data-command-id="nexus.sidebar.toggle"
        data-focus-id="sidebar:toggle"
        aria-label="${escapeHtml(labels.hideSidebar)}"
      >
        ${escapeHtml(labels.hideSidebar)}
      </button>
    </header>
    <div
      class="nexus-sidebar-tabs"
      role="toolbar"
      aria-label="${escapeHtml(labels.sidebarViewsGroup)}"
      data-tablist="true"
      data-tablist-orientation="horizontal"
    >
      ${snapshot.sidebar.views
        .map(
          view =>
            renderRovingToolbarButton({
              action: 'sidebar-view',
              active: activeViewId === view.id,
              className: 'nexus-tab-button',
              label: view.title,
              focusId: `sidebar:${view.id}`,
              data: {
                viewId: view.id
              },
              targetId: 'nexus-primary-sidebar-panel'
            })
        )
        .join('')}
    </div>
    <div
      class="nexus-sidebar-body"
      id="nexus-primary-sidebar-panel"
      role="region"
      aria-labelledby="nexus-primary-sidebar-title"
      tabindex="-1"
    >
      ${renderSidebarContent(
        activeViewId,
        gitStatusStore,
        gitCommitStore,
        gitHistoryStore,
        launchConfigurationEditorService,
        debugSessionStore
      )}
    </div>
  `;
  void commandRegistry;
}

function renderSecondarySidebar(
  sidebar: HTMLElement,
  snapshot: WorkbenchSnapshot,
  labels: WorkbenchAccessibilityLabels
) {
  const activeViewId = snapshot.secondarySidebar.activeViewId;
  sidebar.setAttribute('aria-label', labels.secondarySidebar);
  sidebar.innerHTML = `
    <header class="nexus-section-header" id="nexus-secondary-sidebar-title">
      <div class="nexus-section-title">${escapeHtml(labels.secondarySidebar)}</div>
    </header>
    <div
      class="nexus-sidebar-body"
      id="nexus-secondary-sidebar-panel"
      role="region"
      aria-labelledby="nexus-secondary-sidebar-title"
      tabindex="-1"
    >
      ${
        activeViewId
          ? `<p class="nexus-muted">No secondary content registered for ${escapeHtml(activeViewId)}.</p>`
          : '<p class="nexus-muted">Secondary sidebar is idle.</p>'
      }
    </div>
  `;
}

function renderEditors(
  editor: HTMLElement,
  snapshot: WorkbenchSnapshot,
  settingsEditorService: SettingsEditorService,
  privacyCenterService: PrivacyCenterService,
  launchConfigurationEditorService: LaunchConfigurationEditorService,
  debugSessionStore: DebugSessionStore,
  commandRegistry: CommandRegistry,
  labels: WorkbenchAccessibilityLabels
) {
  const activeGroupId = snapshot.editors.activeGroupId;
  editor.setAttribute('aria-label', labels.editor);
  editor.innerHTML = `
    <div class="nexus-editor-groups" aria-label="${escapeHtml(labels.editorTabsGroup)}">
      ${snapshot.editors.groups
        .map(group => {
          const activeTab = group.tabs.find(tab => tab.id === group.activeTabId) ?? group.tabs[0];
          const panelId = `nexus-editor-panel-${escapeHtml(group.id)}`;
          return `
            <section
              class="nexus-editor-group${group.id === activeGroupId ? ' is-active' : ''}"
              aria-label="${escapeHtml(group.id === activeGroupId ? 'Active editor group' : 'Editor group')}"
            >
              <div
                class="nexus-editor-tabs"
                role="toolbar"
                aria-label="${escapeHtml(labels.editorTabsGroup)}"
                data-tablist="true"
                data-tablist-orientation="horizontal"
              >
                ${group.tabs
                  .map(
                    tab =>
                      renderRovingToolbarButton({
                        action: 'editor-tab',
                        active: tab.id === group.activeTabId,
                        className: 'nexus-editor-tab',
                        label: tab.title,
                        focusId: `editor:${tab.resource}`,
                        data: {
                          resource: tab.resource
                        },
                        targetId: panelId
                      })
                  )
                  .join('')}
              </div>
              <div class="nexus-editor-content" id="${panelId}" role="region" tabindex="-1">
                ${renderEditorContent(
                  activeTab?.resource,
                  activeTab?.title,
                  settingsEditorService,
                  privacyCenterService,
                  launchConfigurationEditorService,
                  debugSessionStore
                )}
              </div>
            </section>
          `;
        })
        .join('')}
    </div>
  `;
  void commandRegistry;
}

function renderPanel(elements: RendererElements, snapshot: WorkbenchSnapshot, labels: WorkbenchAccessibilityLabels) {
  const activeViewId = snapshot.panel.activeViewId ?? 'panel.output';
  const activeViewTitle = snapshot.panel.views.find(view => view.id === activeViewId)?.title ?? 'Panel';
  elements.panel.setAttribute('aria-label', labels.panel);
  elements.panelTabs.innerHTML = snapshot.panel.views
    .map(
      view =>
        renderRovingToolbarButton({
          action: 'panel-view',
          active: activeViewId === view.id,
          className: 'nexus-tab-button',
          label: view.title,
          focusId: `panel:${view.id}`,
          data: {
            viewId: view.id
          },
          targetId: 'nexus-panel-body'
        })
    )
    .join('');
  elements.panelTabs.setAttribute('role', 'toolbar');
  elements.panelTabs.setAttribute('aria-label', labels.panelViewsGroup);
  elements.panelTabs.dataset.tablist = 'true';
  elements.panelTabs.dataset.tablistOrientation = 'horizontal';
  elements.panelBody.id = 'nexus-panel-body';
  elements.panelBody.setAttribute('role', 'region');
  elements.panelBody.setAttribute('tabindex', '-1');
  elements.panelBody.setAttribute('aria-label', activeViewTitle);

  if (activeViewId === 'panel.terminal') {
    elements.panelBody.innerHTML = `
      <div class="nexus-panel-terminal-shell">
        <div class="nexus-panel-toolbar">
          <span class="nexus-muted">Integrated Terminal</span>
        </div>
      </div>
    `;
    elements.panelBody.querySelector('.nexus-panel-terminal-shell')?.appendChild(elements.terminalHost);
  } else {
    elements.panelBody.innerHTML = `
      <div class="nexus-panel-output">
        <p class="nexus-muted">Output channels will appear here.</p>
      </div>
    `;
  }
}

function renderStatusBar(
  statusBar: HTMLElement,
  snapshot: WorkbenchSnapshot,
  commandRegistry: CommandRegistry,
  i18nService: I18nService,
  labels: WorkbenchAccessibilityLabels
) {
  const left = snapshot.statusBar.items.filter(item => item.alignment === 'left' && item.visible !== false);
  const right = snapshot.statusBar.items.filter(item => item.alignment === 'right' && item.visible !== false);
  statusBar.setAttribute('aria-label', labels.statusBar);
  statusBar.innerHTML = `
    <div class="nexus-status-segment">
      ${left.map(item => renderStatusItem(item, i18nService)).join('')}
    </div>
    <div class="nexus-status-segment nexus-status-segment-right">
      ${right.map(item => renderStatusItem(item, i18nService)).join('')}
    </div>
  `;
  void commandRegistry;
}

function renderSidebarContent(
  activeViewId: string | undefined,
  gitStatusStore: GitStatusStore,
  gitCommitStore: GitCommitStore,
  gitHistoryStore: GitHistoryStore,
  launchConfigurationEditorService: LaunchConfigurationEditorService,
  debugSessionStore: DebugSessionStore
) {
  switch (activeViewId) {
    case 'view.explorer':
      return `
        <div class="nexus-card-stack">
          <div class="nexus-card">
            <h3>Explorer</h3>
            <p class="nexus-muted">File tree rendering is not wired yet, but workspace services are active.</p>
          </div>
          <div class="nexus-card">
            <button class="nexus-primary-button" data-action="command" data-command-id="nexus.workspace.pickFolder">Open Workspace</button>
          </div>
        </div>
      `;
    case 'view.search':
      return `
        <div class="nexus-card">
          <h3>Search</h3>
          <p class="nexus-muted">Indexed search UI will appear once the search platform tasks are complete.</p>
        </div>
      `;
    case 'view.git':
      return renderGitSidebar(gitStatusStore, gitCommitStore, gitHistoryStore);
    case 'view.run':
      return renderRunDebugSidebar(launchConfigurationEditorService, debugSessionStore);
    default:
      return '<p class="nexus-muted">No content available for this view yet.</p>';
  }
}

function renderGitSidebar(gitStatusStore: GitStatusStore, gitCommitStore: GitCommitStore, gitHistoryStore: GitHistoryStore) {
  const status = gitStatusStore.getSnapshot();
  const commit = gitCommitStore.getSnapshot();
  const history = gitHistoryStore.getSnapshot();
  return `
    <div class="nexus-card">
      <div class="nexus-split">
        <strong>${escapeHtml(status.branch ?? 'No Repository')}</strong>
        <button class="nexus-ghost-button" data-action="git-refresh">Refresh</button>
      </div>
      <p class="nexus-muted">Staged ${status.staged.length} · Working ${status.workingTree.length}</p>
      <div class="nexus-inline-actions">
        <button class="nexus-primary-button" data-action="git-stage-all">Stage All</button>
        <button class="nexus-ghost-button" data-action="git-unstage-all">Unstage All</button>
      </div>
    </div>
    <div class="nexus-card">
      <h3>Commit</h3>
      <textarea class="nexus-textarea" rows="4" data-git-commit-message="true">${escapeHtml(commit.message)}</textarea>
      <div class="nexus-inline-actions">
        <button class="nexus-primary-button" data-action="git-commit">Commit</button>
      </div>
      ${commit.error ? `<p class="nexus-error">${escapeHtml(commit.error)}</p>` : ''}
    </div>
    <div class="nexus-card">
      <h3>Changes</h3>
      ${renderGitList(status.staged, 'staged')}
      ${renderGitList(status.workingTree, 'working')}
    </div>
    <div class="nexus-card">
      <h3>History</h3>
      <div class="nexus-list">
        ${
          history.entries.length
            ? history.entries
                .slice(0, 5)
                .map(entry => `<div class="nexus-list-item"><strong>${escapeHtml(entry.summary)}</strong><span>${escapeHtml(entry.sha.slice(0, 7))}</span></div>`)
                .join('')
            : '<p class="nexus-muted">No commits loaded.</p>'
        }
      </div>
    </div>
  `;
}

function renderGitList(
  entries: Array<{ path: string; location: 'staged' | 'working'; status?: string }>,
  location: 'staged' | 'working'
) {
  if (!entries.length) {
    return `<p class="nexus-muted">No ${location} changes.</p>`;
  }
  return `
    <div class="nexus-list">
      ${entries
        .map(
          entry => `
            <button class="nexus-list-item nexus-list-item-button" data-action="git-select" data-path="${escapeHtml(entry.path)}" data-location="${escapeHtml(location)}">
              <span>${escapeHtml(entry.path)}</span>
              <span class="nexus-muted">${escapeHtml(entry.status ?? location)}</span>
            </button>
          `
        )
        .join('')}
    </div>
  `;
}

function renderEditorContent(
  resource: string | undefined,
  title: string | undefined,
  settingsEditorService: SettingsEditorService,
  privacyCenterService: PrivacyCenterService,
  launchConfigurationEditorService: LaunchConfigurationEditorService,
  debugSessionStore: DebugSessionStore
) {
  if (!resource) {
    return '<div class="nexus-empty">No editor open.</div>';
  }
  if (resource === 'virtual://welcome') {
    return `
      <div class="nexus-welcome">
        <p class="nexus-eyebrow">Nexus IDE</p>
        <h1>Workbench Shell</h1>
        <p class="nexus-muted">The Electron window now mounts the real workbench shell instead of a placeholder page.</p>
        <div class="nexus-inline-actions">
          <button class="nexus-primary-button" data-action="command" data-command-id="nexus.workspace.pickFolder">Open Workspace</button>
          <button class="nexus-ghost-button" data-action="settings-open" data-scope="user" data-mode="form">Open Settings</button>
        </div>
      </div>
    `;
  }
  if (resource.startsWith('settings://')) {
    return renderSettingsEditor(settingsEditorService);
  }
  if (resource.startsWith('privacy://')) {
    return renderPrivacyCenterEditor(privacyCenterService);
  }
  if (resource.startsWith('run-config://')) {
    return renderLaunchConfigurationEditor(launchConfigurationEditorService);
  }
  const debugSnapshot = debugSessionStore.getSnapshot();
  const resourceBreakpoints = debugSnapshot.breakpoints.filter(breakpoint => breakpoint.source === resource);
  return `
    <div class="nexus-file-view nexus-debuggable-file-view">
      <div class="nexus-file-badge">${escapeHtml(title ?? 'File')}</div>
      <h2>${escapeHtml(resource)}</h2>
      <p class="nexus-muted">The editor host is still a shell renderer, so breakpoint controls are surfaced through a synthetic gutter until Monaco lands.</p>
      <div class="nexus-debug-editor-grid">
        <div class="nexus-debug-gutter" aria-label="Breakpoint gutter">
          ${renderBreakpointGutter(resource, resourceBreakpoints)}
        </div>
        <div class="nexus-debug-editor-placeholder">
          <p class="nexus-muted">Editor layout, tabs, commands, settings, theming, Git, and terminal runtime are active. Monaco DOM mounting is the next renderer step.</p>
          ${
            resourceBreakpoints.length
              ? `
                <div class="nexus-card">
                  <h3>Breakpoints in this file</h3>
                  <div class="nexus-list">
                    ${resourceBreakpoints
                      .map(
                        breakpoint => `
                          <div class="nexus-list-item">
                            <div class="nexus-list-item-meta">
                              <strong>Line ${breakpoint.line}</strong>
                              <div class="nexus-muted">${breakpoint.enabled ? 'Enabled' : 'Disabled'}</div>
                            </div>
                            <div class="nexus-inline-actions">
                              <button
                                class="nexus-ghost-button"
                                data-action="debug-breakpoint-toggle"
                                data-breakpoint-id="${escapeHtml(breakpoint.id)}"
                              >
                                ${breakpoint.enabled ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                class="nexus-ghost-button"
                                data-action="debug-breakpoint-remove"
                                data-breakpoint-id="${escapeHtml(breakpoint.id)}"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        `
                      )
                      .join('')}
                  </div>
                </div>
              `
              : '<p class="nexus-muted">No persisted breakpoints for this file yet.</p>'
          }
        </div>
      </div>
    </div>
  `;
}

function renderRunDebugSidebar(
  launchConfigurationEditorService: LaunchConfigurationEditorService,
  debugSessionStore: DebugSessionStore
) {
  const snapshot = launchConfigurationEditorService.getSnapshot();
  const debugSnapshot = debugSessionStore.getSnapshot();
  const session = debugSnapshot.session;
  const stateLabel = session?.state ?? 'idle';
  const selectedFrame = session?.stackFrames.find(frame => frame.id === debugSnapshot.selectedStackFrameId);
  const defaultBreakpointSource = resolveDefaultBreakpointSource(debugSnapshot);
  return `
    <div class="nexus-card-stack">
      <div class="nexus-card">
        <div class="nexus-split">
          <div>
            <h3>Debug Session</h3>
            <p class="nexus-muted">State: ${escapeHtml(stateLabel)}</p>
          </div>
          <div class="nexus-inline-actions">
            <button class="nexus-primary-button" data-action="run-debug-start" ${snapshot.configurations.length ? '' : 'disabled'}>Start</button>
            <button class="nexus-ghost-button" data-action="run-debug-stop" ${session ? '' : 'disabled'}>Stop</button>
          </div>
        </div>
        ${
          session?.stackFrames.length
            ? `
              <div class="nexus-list">
                ${session.stackFrames
                  .map(
                    frame => `
                      <button
                        class="nexus-list-item nexus-list-item-button${debugSnapshot.selectedStackFrameId === frame.id ? ' is-selected' : ''}"
                        data-action="run-debug-frame-select"
                        data-frame-id="${frame.id}"
                      >
                        <div class="nexus-list-item-meta">
                          <strong>${escapeHtml(frame.name)}</strong>
                          <div class="nexus-muted">${escapeHtml(frame.source?.path ?? 'unknown')}:${frame.line}:${frame.column}</div>
                        </div>
                        <span class="nexus-muted">${debugSnapshot.selectedStackFrameId === frame.id ? 'Selected' : 'Frame'}</span>
                      </button>
                    `
                  )
                  .join('')}
              </div>
            `
            : '<p class="nexus-muted">No stack frames yet. Start a session to capture call stacks.</p>'
        }
        ${
          selectedFrame
            ? `
              <div class="nexus-debug-details">
                <strong>Selected Frame</strong>
                <div class="nexus-muted">${escapeHtml(selectedFrame.name)} · ${escapeHtml(selectedFrame.source?.path ?? 'unknown')}</div>
                <div class="nexus-code">line ${selectedFrame.line}, column ${selectedFrame.column}</div>
              </div>
            `
            : ''
        }
        ${
          debugSnapshot.error
            ? `<p class="nexus-error">${escapeHtml(debugSnapshot.error)}</p>`
            : ''
        }
      </div>
      <div class="nexus-card">
        <div class="nexus-split">
          <div>
            <h3>Breakpoints</h3>
            <p class="nexus-muted">Persisted per workspace and injected into every new debug session.</p>
          </div>
          <span class="nexus-file-badge">${debugSnapshot.breakpoints.length} total</span>
        </div>
        <div class="nexus-debug-form-grid">
          <label class="nexus-run-config-field">
            <span>Source</span>
            <input
              class="nexus-input nexus-code"
              data-debug-breakpoint-source="true"
              value="${escapeHtml(defaultBreakpointSource)}"
              placeholder="/workspace/server.js"
            />
          </label>
          <label class="nexus-run-config-field">
            <span>Line</span>
            <input
              class="nexus-input nexus-code"
              type="number"
              min="1"
              step="1"
              data-debug-breakpoint-line="true"
              value="1"
            />
          </label>
        </div>
        <div class="nexus-inline-actions">
          <button class="nexus-primary-button" data-action="debug-breakpoint-add">Add Breakpoint</button>
        </div>
        ${
          debugSnapshot.breakpoints.length
            ? `
              <div class="nexus-list">
                ${debugSnapshot.breakpoints
                  .slice()
                  .sort((left, right) =>
                    left.source === right.source ? left.line - right.line : left.source.localeCompare(right.source)
                  )
                  .map(
                    breakpoint => `
                      <div class="nexus-list-item">
                        <div class="nexus-list-item-meta">
                          <strong>${escapeHtml(breakpoint.source)}</strong>
                          <div class="nexus-muted">Line ${breakpoint.line}</div>
                        </div>
                        <div class="nexus-inline-actions">
                          <button
                            class="nexus-ghost-button"
                            data-action="debug-breakpoint-toggle"
                            data-breakpoint-id="${escapeHtml(breakpoint.id)}"
                          >
                            ${breakpoint.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            class="nexus-ghost-button"
                            data-action="debug-breakpoint-remove"
                            data-breakpoint-id="${escapeHtml(breakpoint.id)}"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    `
                  )
                  .join('')}
              </div>
            `
            : '<p class="nexus-muted">No persisted breakpoints yet.</p>'
        }
      </div>
      <div class="nexus-card">
        <div class="nexus-split">
          <div>
            <h3>Watch Expressions</h3>
            <p class="nexus-muted">Expressions persist per workspace and refresh whenever execution stops.</p>
          </div>
          <span class="nexus-file-badge">${debugSnapshot.watchExpressions.length} watches</span>
        </div>
        <div class="nexus-inline-actions">
          <input
            class="nexus-input nexus-code"
            data-debug-watch-expression="true"
            placeholder="process.pid"
          />
          <button class="nexus-primary-button" data-action="debug-watch-add">Add Watch</button>
        </div>
        ${
          debugSnapshot.watchExpressions.length
            ? `
              <div class="nexus-list">
                ${debugSnapshot.watchExpressions
                  .map(
                    watch => `
                      <div class="nexus-list-item nexus-debug-watch-item">
                        <div class="nexus-list-item-meta">
                          <input
                            class="nexus-input nexus-code"
                            data-debug-watch-id="${escapeHtml(watch.id)}"
                            value="${escapeHtml(watch.expression)}"
                          />
                          <div class="nexus-muted">
                            ${
                              watch.status === 'evaluating'
                                ? 'Evaluating…'
                                : watch.status === 'error'
                                  ? escapeHtml(watch.error ?? 'Evaluation failed')
                                  : watch.status === 'evaluated'
                                    ? `${escapeHtml(watch.value ?? '')}${watch.type ? ` (${escapeHtml(watch.type)})` : ''}`
                                    : 'Waiting for a stopped frame'
                            }
                          </div>
                        </div>
                        <div class="nexus-inline-actions">
                          <button
                            class="nexus-ghost-button"
                            data-action="debug-watch-apply"
                            data-watch-id="${escapeHtml(watch.id)}"
                          >
                            Apply
                          </button>
                          <button
                            class="nexus-ghost-button"
                            data-action="debug-watch-remove"
                            data-watch-id="${escapeHtml(watch.id)}"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    `
                  )
                  .join('')}
              </div>
            `
            : '<p class="nexus-muted">No watch expressions yet.</p>'
        }
      </div>
      <div class="nexus-card">
        <div class="nexus-split">
          <div>
            <h3>Launch Configurations</h3>
            <p class="nexus-muted">${escapeHtml(describeLaunchConfigurationPath(snapshot))}</p>
          </div>
          <button class="nexus-ghost-button" data-action="run-config-refresh">Refresh</button>
        </div>
        <p class="nexus-muted">
          ${snapshot.configurations.length} configuration${snapshot.configurations.length === 1 ? '' : 's'}
          available for debug sessions.
        </p>
        <div class="nexus-inline-actions">
          <button class="nexus-primary-button" data-action="run-config-open" data-mode="form">Open Editor</button>
          <button class="nexus-ghost-button" data-action="run-config-open" data-mode="json">Open JSON</button>
        </div>
      </div>
      <div class="nexus-card">
        <h3>Add Configuration</h3>
        <div class="nexus-inline-actions">
          <button class="nexus-primary-button" data-action="run-config-add" data-template="node-launch">Node Launch</button>
          <button class="nexus-ghost-button" data-action="run-config-add" data-template="node-attach">Node Attach</button>
        </div>
      </div>
      <div class="nexus-card">
        <h3>Defined Targets</h3>
        ${
          snapshot.configurations.length
            ? `
              <div class="nexus-list">
                ${snapshot.configurations
                  .map(
                    (configuration, index) => `
                      <div class="nexus-list-item">
                        <div class="nexus-list-item-meta">
                          <strong>${escapeHtml(configuration.name)}</strong>
                          <div class="nexus-muted">${escapeHtml(configuration.type)} · ${escapeHtml(configuration.request)}</div>
                        </div>
                        <button class="nexus-ghost-button" data-action="run-config-remove" data-index="${index}">Remove</button>
                      </div>
                    `
                  )
                  .join('')}
              </div>
            `
            : '<p class="nexus-muted">No launch targets yet. Create one before starting a debug session.</p>'
        }
      </div>
      ${
        debugSnapshot.output.length
          ? `
            <div class="nexus-card">
              <h3>Debug Output</h3>
              <pre class="nexus-code-block">${escapeHtml(debugSnapshot.output.slice(-20).join(''))}</pre>
            </div>
          `
          : ''
      }
      ${renderLaunchConfigurationIssues(snapshot.issues)}
    </div>
  `;
}

function renderBreakpointGutter(resource: string, breakpoints: Array<{ id: string; line: number; enabled: boolean }>) {
  const totalLines = Math.max(12, ...breakpoints.map(entry => entry.line));
  const lines = Array.from({ length: totalLines }, (_value, index) => index + 1);
  return lines
    .map(line => {
      const breakpoint = breakpoints.find(entry => entry.line === line);
      return `
        <button
          class="nexus-debug-gutter-line${breakpoint?.enabled ? ' is-active' : ''}"
          data-action="debug-breakpoint-toggle-line"
          data-source="${escapeHtml(resource)}"
          data-line="${line}"
          aria-label="${breakpoint?.enabled ? `Disable breakpoint on line ${line}` : `Enable breakpoint on line ${line}`}"
        >
          <span class="nexus-debug-gutter-line-number">${line}</span>
          <span class="nexus-debug-breakpoint-dot" aria-hidden="true"></span>
        </button>
      `;
    })
    .join('');
}

function resolveDefaultBreakpointSource(debugSnapshot: ReturnType<DebugSessionStore['getSnapshot']>) {
  const selectedFrame = debugSnapshot.session?.stackFrames.find(frame => frame.id === debugSnapshot.selectedStackFrameId);
  return selectedFrame?.source?.path ?? debugSnapshot.breakpoints[0]?.source ?? '';
}

function renderLaunchConfigurationEditor(launchConfigurationEditorService: LaunchConfigurationEditorService) {
  const snapshot = launchConfigurationEditorService.getSnapshot();
  return `
    <div class="nexus-settings-editor nexus-run-config-editor">
      <div class="nexus-settings-toolbar">
        <div>
          <div class="nexus-file-badge">Run & Debug</div>
          <strong>${escapeHtml(snapshot.path ?? '.nexus/launch.json')}</strong>
          <div class="nexus-muted">${escapeHtml(describeLaunchConfigurationPath(snapshot))}</div>
        </div>
        <div class="nexus-inline-actions">
          <button class="nexus-tab-button${snapshot.mode === 'form' ? ' is-active' : ''}" data-action="run-config-mode" data-mode="form">Form</button>
          <button class="nexus-tab-button${snapshot.mode === 'json' ? ' is-active' : ''}" data-action="run-config-mode" data-mode="json">JSON</button>
          <button class="nexus-ghost-button" data-action="run-config-refresh">Refresh</button>
        </div>
      </div>
      ${
        snapshot.mode === 'form'
          ? renderLaunchConfigurationForm(snapshot)
          : renderLaunchConfigurationJson(snapshot)
      }
    </div>
  `;
}

function renderLaunchConfigurationForm(snapshot: LaunchConfigurationEditorSnapshot) {
  return `
    <div class="nexus-card-stack">
      <div class="nexus-card">
        <div class="nexus-split">
          <div>
            <h3>Configurations</h3>
            <p class="nexus-muted">Edit the schema-backed fields consumed by the debug adapter host.</p>
          </div>
          <div class="nexus-inline-actions">
            <button class="nexus-primary-button" data-action="run-config-add" data-template="node-launch">Add Launch</button>
            <button class="nexus-ghost-button" data-action="run-config-add" data-template="node-attach">Add Attach</button>
          </div>
        </div>
      </div>
      ${
        snapshot.configurations.length
          ? snapshot.configurations
              .map((configuration, index) => renderLaunchConfigurationCard(snapshot, configuration, index))
              .join('')
          : `
            <div class="nexus-card">
              <p class="nexus-muted">No launch configurations defined yet. Add one to generate a valid launch.json document.</p>
            </div>
          `
      }
      ${renderLaunchConfigurationIssues(snapshot.issues)}
    </div>
  `;
}

function renderLaunchConfigurationCard(
  snapshot: LaunchConfigurationEditorSnapshot,
  configuration: LaunchConfigurationEditorSnapshot['configurations'][number],
  index: number
) {
  return `
    <section class="nexus-card nexus-run-config-card">
      <div class="nexus-split">
        <div>
          <div class="nexus-file-badge">Configuration ${index + 1}</div>
          <h3>${escapeHtml(configuration.name)}</h3>
          <p class="nexus-muted">${escapeHtml(configuration.type)} · ${escapeHtml(configuration.request)}</p>
        </div>
        <button class="nexus-ghost-button" data-action="run-config-remove" data-index="${index}">Remove</button>
      </div>
      <div class="nexus-run-config-grid">
        ${renderLaunchConfigurationField(index, 'name', 'Name', 'text', configuration.name)}
        ${renderLaunchConfigurationField(index, 'type', 'Type', 'text', configuration.type)}
        ${renderLaunchConfigurationSelect(
          index,
          'request',
          'Request',
          configuration.request,
          [
            { value: 'launch', label: 'launch' },
            { value: 'attach', label: 'attach' }
          ]
        )}
        ${renderLaunchConfigurationField(index, 'program', 'Program', 'text', configuration.program ?? '')}
        ${renderLaunchConfigurationField(index, 'cwd', 'Working Directory', 'text', configuration.cwd ?? '')}
        ${renderLaunchConfigurationField(
          index,
          'preLaunchTask',
          'Pre-launch Task',
          'text',
          configuration.preLaunchTask ?? ''
        )}
        ${renderLaunchConfigurationSelect(
          index,
          'console',
          'Console',
          configuration.console ?? 'integratedTerminal',
          [
            { value: 'integratedTerminal', label: 'Integrated Terminal' },
            { value: 'internalConsole', label: 'Internal Console' },
            { value: 'externalTerminal', label: 'External Terminal' }
          ]
        )}
        ${renderLaunchConfigurationCheckbox(index, 'stopOnEntry', 'Stop On Entry', configuration.stopOnEntry ?? false)}
      </div>
      <div class="nexus-run-config-grid nexus-run-config-grid-wide">
        ${renderLaunchConfigurationTextarea(
          index,
          'argsText',
          'Arguments',
          (configuration.args ?? []).join('\n'),
          'One argument per line or comma-separated.'
        )}
        ${renderLaunchConfigurationTextarea(
          index,
          'envText',
          'Environment',
          formatEnvironment(configuration.env),
          'Use KEY=VALUE entries, one per line.'
        )}
      </div>
      ${
        snapshot.schemaUri
          ? `<p class="nexus-muted">Schema: <span class="nexus-code">${escapeHtml(snapshot.schemaUri)}</span></p>`
          : ''
      }
    </section>
  `;
}

function renderLaunchConfigurationField(
  index: number,
  field: string,
  label: string,
  type: 'text' | 'number',
  value: string | number
) {
  return `
    <label class="nexus-run-config-field">
      <span>${escapeHtml(label)}</span>
      <input
        class="nexus-input"
        type="${type}"
        value="${escapeHtml(String(value))}"
        data-run-config-index="${index}"
        data-run-config-field="${escapeHtml(field)}"
      />
    </label>
  `;
}

function renderLaunchConfigurationSelect(
  index: number,
  field: string,
  label: string,
  value: string,
  options: ReadonlyArray<{ value: string; label: string }>
) {
  return `
    <label class="nexus-run-config-field">
      <span>${escapeHtml(label)}</span>
      <select class="nexus-select" data-run-config-index="${index}" data-run-config-field="${escapeHtml(field)}">
        ${options
          .map(
            option => `
              <option value="${escapeHtml(option.value)}"${option.value === value ? ' selected' : ''}>${escapeHtml(option.label)}</option>
            `
          )
          .join('')}
      </select>
    </label>
  `;
}

function renderLaunchConfigurationCheckbox(index: number, field: string, label: string, value: boolean) {
  return `
    <label class="nexus-run-config-field nexus-checkbox">
      <input
        type="checkbox"
        ${value ? 'checked' : ''}
        data-run-config-index="${index}"
        data-run-config-field="${escapeHtml(field)}"
      />
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function renderLaunchConfigurationTextarea(
  index: number,
  field: string,
  label: string,
  value: string,
  helpText: string
) {
  return `
    <label class="nexus-run-config-field">
      <span>${escapeHtml(label)}</span>
      <textarea
        class="nexus-textarea"
        rows="6"
        data-run-config-index="${index}"
        data-run-config-field="${escapeHtml(field)}"
      >${escapeHtml(value)}</textarea>
      <span class="nexus-muted">${escapeHtml(helpText)}</span>
    </label>
  `;
}

function renderLaunchConfigurationJson(snapshot: LaunchConfigurationEditorSnapshot) {
  return `
    <div class="nexus-settings-json">
      <textarea class="nexus-textarea nexus-settings-json-input" rows="20" data-run-config-json="true">${escapeHtml(snapshot.jsonText)}</textarea>
      <div class="nexus-inline-actions">
        <button class="nexus-primary-button" data-action="run-config-apply-json">Apply JSON</button>
      </div>
      ${renderLaunchConfigurationIssues(snapshot.issues)}
      <p class="nexus-muted">Schema-backed JSON is stored at ${escapeHtml(snapshot.path ?? '.nexus/launch.json')}.</p>
    </div>
  `;
}

function renderLaunchConfigurationIssues(issues: readonly { path: string; message: string }[]) {
  if (!issues.length) {
    return '';
  }
  return `
    <div class="nexus-card nexus-error-block">
      <h3>Validation Issues</h3>
      <div class="nexus-list">
        ${issues
          .map(
            issue => `
              <div class="nexus-list-item">
                <div class="nexus-list-item-meta">
                  <strong>${escapeHtml(issue.path)}</strong>
                  <span>${escapeHtml(issue.message)}</span>
                </div>
              </div>
            `
          )
          .join('')}
      </div>
    </div>
  `;
}

function describeLaunchConfigurationPath(snapshot: Pick<LaunchConfigurationEditorSnapshot, 'path' | 'exists'>) {
  const pathLabel = snapshot.path ?? '.nexus/launch.json';
  return `${snapshot.exists ? 'Persisted' : 'Default'} document at ${pathLabel}`;
}

function formatEnvironment(env: Readonly<Record<string, string>> | undefined) {
  if (!env) {
    return '';
  }
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

function renderSettingsEditor(settingsEditorService: SettingsEditorService) {
  const snapshot = settingsEditorService.getSnapshot();
  return `
    <div class="nexus-settings-editor">
      <div class="nexus-settings-toolbar">
        <div class="nexus-inline-actions">
          ${snapshot.availableScopes
            .map(
              scope => `
                <button
                  class="nexus-tab-button${snapshot.activeScope === scope ? ' is-active' : ''}"
                  data-action="settings-scope"
                  data-scope="${escapeHtml(scope)}"
                  data-mode="${escapeHtml(snapshot.activeMode)}"
                >
                  ${scope === 'user' ? 'User' : 'Workspace'}
                </button>
              `
            )
            .join('')}
        </div>
        <div class="nexus-inline-actions">
          <button
            class="nexus-tab-button${snapshot.activeMode === 'form' ? ' is-active' : ''}"
            data-action="settings-mode"
            data-scope="${escapeHtml(snapshot.activeScope)}"
            data-mode="form"
          >
            Form
          </button>
          <button
            class="nexus-tab-button${snapshot.activeMode === 'json' ? ' is-active' : ''}"
            data-action="settings-mode"
            data-scope="${escapeHtml(snapshot.activeScope)}"
            data-mode="json"
          >
            JSON
          </button>
        </div>
        <input
          class="nexus-search-input"
          type="search"
          placeholder="Search settings"
          value="${escapeHtml(snapshot.query)}"
          data-settings-query="true"
        />
      </div>
      ${
        snapshot.activeMode === 'form'
          ? renderSettingsForm(snapshot.activeScope, snapshot.sections)
          : renderSettingsJson(snapshot.activeScope, snapshot.jsonText, snapshot.issues)
      }
    </div>
  `;
}

function renderPrivacyCenterEditor(privacyCenterService: PrivacyCenterService) {
  const snapshot = privacyCenterService.getSnapshot();
  const consent = snapshot.consent;
  if (!consent) {
    return `
      <div class="nexus-card">
        <h3>Privacy Center</h3>
        <p class="nexus-error">${escapeHtml(snapshot.error ?? 'Privacy data is unavailable.')}</p>
        <div class="nexus-inline-actions">
          <button class="nexus-primary-button" data-action="privacy-refresh">Retry</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="nexus-settings-editor nexus-privacy-center">
      <div class="nexus-settings-toolbar">
        <div>
          <div class="nexus-file-badge">Privacy</div>
          <strong>Telemetry Consent & Data Controls</strong>
          <div class="nexus-muted">Workspace: ${escapeHtml(consent.workspaceId ?? 'No workspace override')}</div>
        </div>
        <div class="nexus-inline-actions">
          <button class="nexus-ghost-button" data-action="privacy-refresh">Refresh</button>
          <button class="nexus-ghost-button" data-action="privacy-open">Reopen</button>
        </div>
      </div>
      <div class="nexus-card-stack">
        <div class="nexus-card">
          <div class="nexus-split">
            <div>
              <h3>Buffered Telemetry</h3>
              <p class="nexus-muted">Events are stored locally at ${escapeHtml(consent.telemetry.bufferPath)}.</p>
            </div>
            <span class="nexus-file-badge">${consent.telemetry.eventCount} events</span>
          </div>
          <div class="nexus-run-config-grid">
            <div class="nexus-card">
              <strong>Collection</strong>
              <div class="nexus-muted">${consent.telemetry.collectionEnabled ? 'Enabled' : 'Disabled'}</div>
            </div>
            <div class="nexus-card">
              <strong>Buffer Size</strong>
              <div class="nexus-muted">${consent.telemetry.fileBytes} bytes</div>
            </div>
            <div class="nexus-card">
              <strong>Dropped</strong>
              <div class="nexus-muted">${consent.telemetry.dropped}</div>
            </div>
          </div>
          <div class="nexus-inline-actions">
            <button class="nexus-primary-button" data-action="privacy-export" data-mode="all">Export All Data</button>
            <button class="nexus-ghost-button" data-action="privacy-export" data-mode="workspace" ${consent.workspaceId ? '' : 'disabled'}>Export Workspace Data</button>
            <button class="nexus-ghost-button" data-action="privacy-delete" data-delete-exports="true">Delete Buffered Data</button>
          </div>
          ${
            snapshot.lastExport
              ? `<p class="nexus-muted">Last export: ${escapeHtml(snapshot.lastExport.path)} (${snapshot.lastExport.recordCount} records)</p>`
              : ''
          }
          ${
            snapshot.lastDelete
              ? `<p class="nexus-muted">Last delete cleared ${snapshot.lastDelete.clearedRecords} buffered record${snapshot.lastDelete.clearedRecords === 1 ? '' : 's'}.</p>`
              : ''
          }
        </div>
        <div class="nexus-card">
          <h3>User Consent</h3>
          <p class="nexus-muted">Applies across all workspaces unless a workspace override is saved.</p>
          ${renderPrivacyConsentForm('user', consent.user, consent.categories, snapshot.loading)}
        </div>
        ${
          consent.workspaceId
            ? `
              <div class="nexus-card">
                <h3>Workspace Consent</h3>
                <p class="nexus-muted">Overrides the user baseline for ${escapeHtml(consent.workspaceId)}.</p>
                ${renderPrivacyConsentForm(
                  'workspace',
                  consent.workspace ?? {
                    scope: 'workspace',
                    workspaceId: consent.workspaceId,
                    source: 'default',
                    preferences: consent.user.preferences
                  },
                  consent.categories,
                  snapshot.loading
                )}
              </div>
            `
            : ''
        }
        <div class="nexus-card">
          <h3>Effective Consent</h3>
          <div class="nexus-list">
            ${consent.categories
              .map(
                category => `
                  <div class="nexus-list-item">
                    <div class="nexus-list-item-meta">
                      <strong>${escapeHtml(category.title)}</strong>
                      <div class="nexus-muted">${escapeHtml(category.description)}</div>
                    </div>
                    <span class="nexus-file-badge">${consent.effective.preferences[category.key] ? 'On' : 'Off'}</span>
                  </div>
                `
              )
              .join('')}
          </div>
          <p class="nexus-muted">
            Effective scope: ${escapeHtml(consent.effective.scope)}
            ${consent.effective.updatedAt ? ` · Updated ${new Date(consent.effective.updatedAt).toLocaleString()}` : ' · Not yet reviewed'}
          </p>
        </div>
        ${
          snapshot.error
            ? `<div class="nexus-card nexus-error-block"><strong>Privacy Error</strong><div>${escapeHtml(snapshot.error)}</div></div>`
            : ''
        }
      </div>
    </div>
  `;
}

function renderPrivacyConsentForm(
  scope: 'user' | 'workspace',
  record: {
    scope?: string;
    workspaceId?: string;
    source?: string;
    preferences: Record<'usageTelemetry' | 'crashReports', boolean>;
    updatedAt?: number;
  },
  categories: Array<{ key: 'usageTelemetry' | 'crashReports'; title: string; description: string }>,
  loading: boolean
) {
  return `
    <div class="nexus-card-stack">
      ${categories
        .map(
          category => `
            <label class="nexus-setting-row">
              <div>
                <strong>${escapeHtml(category.title)}</strong>
                <div class="nexus-muted">${escapeHtml(category.description)}</div>
              </div>
              <div class="nexus-setting-control">
                <input
                  type="checkbox"
                  ${record.preferences[category.key] ? 'checked' : ''}
                  data-privacy-${category.key === 'usageTelemetry' ? 'usage' : 'crash'}="${scope}"
                />
              </div>
            </label>
          `
        )
        .join('')}
      <div class="nexus-inline-actions">
        <button class="nexus-primary-button" data-action="privacy-consent-apply" data-scope="${scope}" ${loading ? 'disabled' : ''}>Save ${scope === 'user' ? 'User' : 'Workspace'} Consent</button>
      </div>
      <p class="nexus-muted">${record.updatedAt ? `Updated ${new Date(record.updatedAt).toLocaleString()}` : 'Not yet reviewed.'}</p>
    </div>
  `;
}

function renderSettingsForm(
  scope: SettingsScope,
  sections: ReturnType<SettingsEditorService['querySections']>
) {
  return sections
    .map(
      section => `
        <section class="nexus-settings-section">
          <h3>${escapeHtml(section.title)}</h3>
          <div class="nexus-settings-grid">
            ${section.entries.map(entry => renderSettingEntry(scope, entry)).join('')}
          </div>
        </section>
      `
    )
    .join('');
}

function renderSettingEntry(
  scope: SettingsScope,
  entry: {
    key: string;
    title: string;
    description: string;
    type: string;
    value: unknown;
    defaultValue: unknown;
    enum?: readonly unknown[];
    minimum?: number;
    maximum?: number;
  }
) {
  return `
    <div class="nexus-setting-row">
      <div class="nexus-setting-meta">
        <strong>${escapeHtml(entry.title)}</strong>
        <div class="nexus-muted">${escapeHtml(entry.key)}</div>
        <p class="nexus-muted">${escapeHtml(entry.description)}</p>
      </div>
      <div class="nexus-setting-control">
        ${renderSettingControl(scope, entry)}
        <button class="nexus-ghost-button" data-action="settings-reset" data-key="${escapeHtml(entry.key)}" data-scope="${escapeHtml(scope)}">Reset</button>
      </div>
    </div>
  `;
}

function renderSettingControl(
  scope: SettingsScope,
  entry: {
    key: string;
    type: string;
    value: unknown;
    enum?: readonly unknown[];
    minimum?: number;
    maximum?: number;
  }
) {
  if (entry.enum?.length) {
    return `
      <select class="nexus-select" data-setting-key="${escapeHtml(entry.key)}" data-setting-scope="${escapeHtml(scope)}">
        ${entry.enum
          .map(
            option => `
              <option value="${escapeHtml(String(option))}"${option === entry.value ? ' selected' : ''}>${escapeHtml(String(option))}</option>
            `
          )
          .join('')}
      </select>
    `;
  }
  if (entry.type === 'boolean') {
    return `
      <label class="nexus-checkbox">
        <input
          type="checkbox"
          data-setting-key="${escapeHtml(entry.key)}"
          data-setting-scope="${escapeHtml(scope)}"
          ${entry.value ? 'checked' : ''}
        />
        <span>Enabled</span>
      </label>
    `;
  }
  if (entry.type === 'integer' || entry.type === 'number') {
    return `
      <input
        class="nexus-input"
        type="number"
        value="${escapeHtml(String(entry.value ?? ''))}"
        min="${entry.minimum ?? ''}"
        max="${entry.maximum ?? ''}"
        data-setting-key="${escapeHtml(entry.key)}"
        data-setting-scope="${escapeHtml(scope)}"
      />
    `;
  }
  return `
    <input
      class="nexus-input"
      type="text"
      value="${escapeHtml(String(entry.value ?? ''))}"
      data-setting-key="${escapeHtml(entry.key)}"
      data-setting-scope="${escapeHtml(scope)}"
    />
  `;
}

function renderSettingsJson(
  scope: SettingsScope,
  jsonText: string,
  issues: Array<{ message: string }>
) {
  return `
    <div class="nexus-settings-json">
      <textarea class="nexus-textarea nexus-settings-json-input" rows="18" data-settings-json="true" data-scope="${escapeHtml(scope)}">${escapeHtml(jsonText)}</textarea>
      <div class="nexus-inline-actions">
        <button class="nexus-primary-button" data-action="settings-apply-json">Apply JSON</button>
      </div>
      ${
        issues.length
          ? `<div class="nexus-error-block">${issues.map(issue => `<p>${escapeHtml(issue.message)}</p>`).join('')}</div>`
          : '<p class="nexus-muted">JSON updates will replace the active scope settings.</p>'
      }
    </div>
  `;
}

function renderStatusItem(item: WorkbenchSnapshot['statusBar']['items'][number], i18nService: I18nService) {
  const text = resolveStatusText(item.text, i18nService);
  const tooltip = item.tooltip ? resolveStatusText(item.tooltip, i18nService) : text;
  const ariaLabel = item.ariaLabel ? resolveStatusText(item.ariaLabel, i18nService) : tooltip;
  const content = `
    <span class="nexus-status-label">${escapeHtml(text)}</span>
    ${
      item.progress
        ? `<progress
            max="${item.progress.total ?? 100}"
            value="${item.progress.value}"
            class="nexus-progress"
            aria-label="${escapeHtml(`${ariaLabel} progress`)}"
          ></progress>`
        : ''
    }
  `;
  if (item.commandId) {
    return `<button
      type="button"
      class="nexus-status-item"
      title="${escapeHtml(tooltip)}"
      aria-label="${escapeHtml(ariaLabel)}"
      data-action="command"
      data-command-id="${escapeHtml(item.commandId)}"
      data-focus-id="status:${escapeHtml(item.id)}"
    >${content}</button>`;
  }
  return `<div class="nexus-status-item" title="${escapeHtml(tooltip)}" aria-label="${escapeHtml(ariaLabel)}">${content}</div>`;
}

function resolveStatusText(
  value: WorkbenchSnapshot['statusBar']['items'][number]['text'],
  i18nService: I18nService
) {
  return typeof value === 'string' ? value : i18nService.format(value);
}

function resolveActiveSidebarTitle(snapshot: WorkbenchSnapshot) {
  const active = snapshot.sidebar.views.find(view => view.id === snapshot.sidebar.activeViewId);
  return active?.title ?? 'Sidebar';
}

function captureFocusedElementId(host: HTMLElement) {
  const activeElement = document.activeElement as HTMLElement | null;
  if (!activeElement || !host.contains(activeElement)) {
    return undefined;
  }
  return activeElement.dataset.focusId;
}

function restoreFocusedElement(host: HTMLElement, focusId?: string) {
  if (!focusId) {
    return;
  }
  const nextTarget = Array.from(host.querySelectorAll<HTMLElement>('[data-focus-id]')).find(
    entry => entry.dataset.focusId === focusId
  );
  nextTarget?.focus();
}

function applyPlacement(element: HTMLElement, placement: WorkbenchSnapshot['placements'][keyof WorkbenchSnapshot['placements']]) {
  element.style.gridColumn = `${placement.columnStart} / ${placement.columnEnd}`;
  element.style.gridRow = `${placement.rowStart} / ${placement.rowEnd}`;
  element.hidden = placement.hidden;
}

function readControlValue(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  if (control instanceof HTMLInputElement && control.type === 'checkbox') {
    return control.checked;
  }
  if (control instanceof HTMLInputElement && control.type === 'number') {
    return control.value === '' ? 0 : Number(control.value);
  }
  return control.value;
}

function parseDatasetJson(value?: string) {
  if (!value) {
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function injectWorkbenchStyles() {
  if (document.getElementById('nexus-workbench-style')) {
    return;
  }
  const style = document.createElement('style');
  style.id = 'nexus-workbench-style';
  style.textContent = `
    :root {
      color-scheme: dark;
      --nexus-font-ui: var(--nexus-font-family-ui, "IBM Plex Sans", sans-serif);
      --nexus-font-mono: var(--nexus-font-family-mono, "IBM Plex Mono", monospace);
    }
    body {
      margin: 0;
      font-family: var(--nexus-font-ui);
      background: var(--nexus-workbench-background, #181818);
      color: var(--nexus-workbench-foreground, #f5f5f5);
      overflow: hidden;
    }
    body.nexus-mounted::before,
    body.nexus-mounted::after {
      display: none;
      content: none;
    }
    #nexus-workbench-app {
      display: grid;
      width: 100vw;
      height: 100vh;
      background:
        radial-gradient(circle at top right, color-mix(in srgb, var(--nexus-panel-background, #202020) 85%, transparent), transparent 40%),
        var(--nexus-workbench-background, #181818);
    }
    .nexus-sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .nexus-skip-link {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 20;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--nexus-button-background, #2d6cdf);
      color: var(--nexus-button-foreground, #fff);
      text-decoration: none;
      transform: translateY(-140%);
      transition: transform 120ms ease;
    }
    .nexus-skip-link:focus {
      transform: translateY(0);
    }
    .nexus-surface {
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      border-color: var(--nexus-border, rgba(255,255,255,0.08));
    }
    .nexus-activity-bar {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 12px 8px;
      background: var(--nexus-activity-bar-background, #111111);
      border-right: 1px solid var(--nexus-border, rgba(255,255,255,0.08));
    }
    .nexus-activity-nav {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      height: 100%;
    }
    .nexus-brand {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: var(--nexus-button-background, #2d6cdf);
      color: var(--nexus-button-foreground, #fff);
      font-weight: 700;
    }
    .nexus-activity-items,
    .nexus-activity-footer {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .nexus-activity-item,
    .nexus-tab-button,
    .nexus-ghost-button,
    .nexus-primary-button,
    .nexus-editor-tab,
    .nexus-status-item,
    .nexus-list-item-button {
      font: inherit;
      border: 0;
      cursor: pointer;
    }
    .nexus-activity-item {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: transparent;
      color: var(--nexus-activity-bar-foreground, #cfcfcf);
    }
    .nexus-activity-item.is-active {
      background: color-mix(in srgb, var(--nexus-button-background, #2d6cdf) 20%, transparent);
      color: var(--nexus-foreground, #fff);
    }
    .nexus-activity-item:focus-visible,
    .nexus-tab-button:focus-visible,
    .nexus-ghost-button:focus-visible,
    .nexus-primary-button:focus-visible,
    .nexus-editor-tab:focus-visible,
    .nexus-status-item:focus-visible,
    .nexus-list-item-button:focus-visible,
    .nexus-input:focus-visible,
    .nexus-select:focus-visible,
    .nexus-search-input:focus-visible,
    .nexus-textarea:focus-visible {
      outline: 2px solid var(--nexus-button-background, #2d6cdf);
      outline-offset: 2px;
    }
    .nexus-sidebar,
    .nexus-secondary-sidebar,
    .nexus-panel,
    .nexus-editor-group {
      background: var(--nexus-sidebar-background, #1b1b1b);
      border-right: 1px solid var(--nexus-border, rgba(255,255,255,0.08));
    }
    .nexus-panel {
      border-top: 1px solid var(--nexus-border, rgba(255,255,255,0.08));
      display: flex;
      flex-direction: column;
    }
    .nexus-section-header,
    .nexus-settings-toolbar,
    .nexus-panel-tabs,
    .nexus-status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
    }
    .nexus-section-title,
    .nexus-panel-tabs {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .nexus-split {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .nexus-sidebar-tabs,
    .nexus-inline-actions,
    .nexus-editor-tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .nexus-sidebar-body,
    .nexus-panel-body,
    .nexus-editor-content {
      padding: 12px;
      overflow: auto;
      height: 100%;
      box-sizing: border-box;
    }
    .nexus-editor {
      background: var(--nexus-editor-background, #141414);
    }
    .nexus-editor-groups {
      display: grid;
      gap: 12px;
      height: 100%;
      padding: 12px;
      box-sizing: border-box;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    }
    .nexus-editor-group {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--nexus-border, rgba(255,255,255,0.08));
      border-radius: 14px;
      overflow: hidden;
      background: color-mix(in srgb, var(--nexus-editor-background, #141414) 90%, #fff 10%);
    }
    .nexus-editor-tab,
    .nexus-tab-button {
      padding: 8px 12px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--nexus-panel-background, #202020) 82%, transparent);
      color: inherit;
    }
    .nexus-editor-tab.is-active,
    .nexus-tab-button.is-active {
      background: var(--nexus-button-background, #2d6cdf);
      color: var(--nexus-button-foreground, #fff);
    }
    .nexus-status-bar {
      background: var(--nexus-status-bar-background, #0f172a);
      color: var(--nexus-status-bar-foreground, #f8fafc);
      border-top: 1px solid var(--nexus-border, rgba(255,255,255,0.08));
      padding: 4px 10px;
    }
    .nexus-status-segment {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .nexus-status-segment-right {
      margin-left: auto;
    }
    .nexus-status-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 8px;
      background: transparent;
      color: inherit;
    }
    .nexus-card,
    .nexus-setting-row,
    .nexus-welcome,
    .nexus-file-view {
      border: 1px solid var(--nexus-border, rgba(255,255,255,0.08));
      background: color-mix(in srgb, var(--nexus-panel-background, #202020) 88%, transparent);
      border-radius: 16px;
      padding: 14px;
    }
    .nexus-card-stack,
    .nexus-settings-section,
    .nexus-list {
      display: grid;
      gap: 12px;
    }
    .nexus-list-item-meta,
    .nexus-run-config-field,
    .nexus-run-config-grid,
    .nexus-run-config-editor {
      display: grid;
      gap: 8px;
    }
    .nexus-run-config-grid {
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }
    .nexus-debug-form-grid,
    .nexus-debug-editor-grid {
      display: grid;
      gap: 12px;
    }
    .nexus-debug-form-grid {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      margin: 12px 0;
    }
    .nexus-debug-editor-grid {
      grid-template-columns: minmax(92px, 112px) 1fr;
      align-items: start;
      margin-top: 14px;
    }
    .nexus-debug-gutter,
    .nexus-debug-editor-placeholder,
    .nexus-debug-details {
      display: grid;
      gap: 10px;
    }
    .nexus-debug-gutter {
      padding: 10px;
      border-radius: 14px;
      background: var(--nexus-input-background, rgba(0,0,0,0.22));
    }
    .nexus-debug-gutter-line {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 12px;
      padding: 6px 8px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
      text-align: left;
    }
    .nexus-debug-gutter-line.is-active {
      background: color-mix(in srgb, var(--nexus-button-background, #2d6cdf) 16%, transparent);
    }
    .nexus-debug-gutter-line-number {
      font: 12px/1 var(--nexus-font-mono);
      opacity: 0.72;
    }
    .nexus-debug-breakpoint-dot {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--nexus-button-background, #2d6cdf) 55%, transparent);
      background: transparent;
    }
    .nexus-debug-gutter-line.is-active .nexus-debug-breakpoint-dot {
      background: var(--nexus-button-background, #2d6cdf);
      border-color: var(--nexus-button-background, #2d6cdf);
    }
    .nexus-debug-watch-item {
      align-items: flex-start;
    }
    .nexus-run-config-grid-wide {
      margin-top: 12px;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }
    .nexus-list-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--nexus-panel-background, #202020) 75%, transparent);
    }
    .nexus-list-item-button {
      width: 100%;
      color: inherit;
      text-align: left;
    }
    .nexus-list-item-button.is-selected {
      background: color-mix(in srgb, var(--nexus-button-background, #2d6cdf) 18%, transparent);
      border: 1px solid color-mix(in srgb, var(--nexus-button-background, #2d6cdf) 45%, transparent);
    }
    .nexus-primary-button,
    .nexus-ghost-button {
      padding: 8px 12px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--nexus-panel-background, #202020) 80%, transparent);
      color: inherit;
    }
    .nexus-primary-button {
      background: var(--nexus-button-background, #2d6cdf);
      color: var(--nexus-button-foreground, #fff);
    }
    .nexus-input,
    .nexus-select,
    .nexus-search-input,
    .nexus-textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--nexus-input-border, rgba(255,255,255,0.12));
      border-radius: 10px;
      padding: 10px 12px;
      background: var(--nexus-input-background, rgba(0,0,0,0.22));
      color: inherit;
      font: inherit;
    }
    .nexus-textarea {
      resize: vertical;
      font-family: var(--nexus-font-mono);
    }
    .nexus-settings-grid,
    .nexus-setting-control {
      display: grid;
      gap: 12px;
    }
    .nexus-setting-row {
      display: grid;
      gap: 12px;
      grid-template-columns: minmax(220px, 2fr) minmax(220px, 1fr);
    }
    .nexus-muted {
      opacity: 0.72;
    }
    .nexus-code {
      font-family: var(--nexus-font-mono);
      font-size: 12px;
    }
    .nexus-code-block {
      margin: 0;
      max-height: 180px;
      overflow: auto;
      border-radius: 10px;
      padding: 10px 12px;
      background: var(--nexus-input-background, rgba(0,0,0,0.22));
      font: 12px/1.45 var(--nexus-font-mono);
      white-space: pre-wrap;
      word-break: break-word;
    }
    .nexus-error,
    .nexus-error-block {
      color: var(--nexus-error-foreground, #ff8a80);
    }
    .nexus-file-badge,
    .nexus-eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 12px;
      opacity: 0.72;
    }
    .nexus-panel-terminal-shell,
    .nexus-terminal-host {
      height: 100%;
      min-height: 0;
    }
    .nexus-terminal-host {
      border-radius: 12px;
      overflow: hidden;
      background: var(--nexus-terminal-background, #111);
    }
    .nexus-progress {
      width: 48px;
      height: 6px;
    }
    @media (max-width: 980px) {
      .nexus-setting-row {
        grid-template-columns: 1fr;
      }
      .nexus-editor-groups {
        grid-template-columns: 1fr;
      }
      .nexus-debug-editor-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function requireElement<T extends HTMLElement>(host: ParentNode, selector: string) {
  const element = host.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Expected element for selector ${selector}`);
  }
  return element;
}
