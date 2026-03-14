import { DEFAULT_ACTIVITY_ITEMS } from './workbench-shell';
import { bootstrapPersistentWorkbenchShell } from './workbench-layout-store';
import { CommandRegistry } from './command-registry';
import { CommandPaletteService } from './command-palette';
import { fuzzyScore } from './fuzzy-match';
import {
  I18nService,
  WORKBENCH_I18N_BUNDLES,
  WORKBENCH_SUPPORTED_LOCALES,
  type LocalizedText
} from './i18n-service';
import { WorkspaceService } from './workspace-service';
import { WorkspaceStateService } from './workspace-state-service';
import { GitCommitStore } from './git-commit-store';
import { GitHistoryStore } from './git-history-store';
import { GitRepositoryStore } from './git-repository-store';
import { GitStatusStore, type GitStatusSnapshot } from './git-status-store';
import { SettingsService } from './settings-service';
import { TerminalHost } from './terminal-host';
import { WorkspaceHotExitService } from './workspace-hot-exit-service';

const env = process.env.NEXUS_ENV ?? 'development';
const workspaceIdentity = process.env.NEXUS_WORKSPACE_ID ?? process.env.NEXUS_WORKSPACE_PATH ?? 'default';
const i18nService = new I18nService({
  locale: process.env.NEXUS_LOCALE ?? 'en-US',
  bundles: WORKBENCH_I18N_BUNDLES
});
const layoutHandle = bootstrapPersistentWorkbenchShell({ workspaceId: workspaceIdentity, i18n: i18nService });
const shell = layoutHandle.shell;
const workspaceStateService = new WorkspaceStateService({ workspaceId: workspaceIdentity, shell });
const hotExitService = new WorkspaceHotExitService({ workspaceId: workspaceIdentity });
const commandRegistry = new CommandRegistry();
const commandPalette = new CommandPaletteService(commandRegistry, { i18n: i18nService });
const workspaceBridge = typeof window !== 'undefined' ? window.nexus : undefined;
const workspaceService = new WorkspaceService(workspaceBridge);
const gitRepositoryStore = new GitRepositoryStore(workspaceBridge);
const gitStatusStore = new GitStatusStore(workspaceBridge);
const gitCommitStore = new GitCommitStore(workspaceBridge);
const gitHistoryStore = new GitHistoryStore(workspaceBridge);
const settingsService = new SettingsService({
  shell,
  workspacePath: process.env.NEXUS_WORKSPACE_PATH,
  i18n: i18nService
});
settingsService.initialize();
let terminalHost: TerminalHost | undefined;
if (typeof document !== 'undefined') {
  const disposeDrop = workspaceService.registerDropTarget(document.body);
  window.addEventListener('beforeunload', () => disposeDrop());
  const mountTerminal = () => {
    if (terminalHost || !document.body) return;
    const container = document.createElement('div');
    container.id = 'nexus-terminal-host';
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '0',
      left: '56px',
      right: '0',
      height: '240px',
      background: shell.getThemeTokens()['--nexus-panel-bg'] ?? '#1e1e1e',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      zIndex: '10'
    });
    document.body.appendChild(container);
    terminalHost = new TerminalHost({
      container,
      theme: {
        background: shell.getThemeTokens()['--nexus-panel-bg'],
        foreground: shell.getThemeTokens()['--nexus-status-bar-fg']
      }
    });
    hotExitService.attachTerminalHost(terminalHost);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountTerminal, { once: true });
  } else {
    mountTerminal();
  }
  window.addEventListener('beforeunload', () => {
    void hotExitService.flushNow();
  });
}
process.once('exit', () => {
  workspaceStateService.dispose();
  layoutHandle.dispose();
  terminalHost?.dispose();
  hotExitService.dispose();
});
workspaceService.refreshRecentWorkspaces().catch(() => undefined);

DEFAULT_ACTIVITY_ITEMS.forEach(activity => shell.registerActivity(activity));

shell.registerSidebarView({ id: 'view.explorer', title: 'Explorer', order: 1, containerId: 'activity.explorer' });
shell.registerSidebarView({ id: 'view.search', title: 'Search', order: 2, containerId: 'activity.search' });
shell.registerSidebarView({ id: 'view.git', title: 'Source Control', order: 3, containerId: 'activity.git' });

shell.registerPanelView({ id: 'panel.terminal', title: 'Terminal', order: 1 });
shell.registerPanelView({ id: 'panel.output', title: 'Output', order: 2 });

shell.registerStatusItem({ id: 'status.encoding', alignment: 'right', text: 'UTF-8', priority: 5 });
updateLocaleStatusItem();
const disposeLocaleListener = i18nService.onDidChangeLocale(() => {
  updateLocaleStatusItem();
});
process.once('exit', () => {
  disposeLocaleListener();
});

function t(key: string, fallback: string, args?: Record<string, string | number>): LocalizedText {
  return { key, fallback, args };
}

commandPalette.registerProvider({
  id: 'recent-workspaces',
  getItems: query => {
    const actionItems = [
      {
        id: 'workspace:open-picker',
        type: 'custom' as const,
        label: i18nService.format(t('quickopen.workspace.open', 'Open Workspace…')),
        detail: i18nService.format(t('quickopen.workspace.open.detail', 'Pick a folder to open')),
        score: query ? fuzzyScore(query, 'open workspace') : 1,
        source: 'workspace-action',
        commandId: 'nexus.workspace.pickFolder',
        metadata: {}
      }
    ];
    const recents = workspaceService.getRecentWorkspaces();
    const recentItems = recents
      .map(entry => {
        const score = query ? fuzzyScore(query, entry.label) : 0.2;
        return {
          id: `workspace:${entry.path}`,
          type: 'workspace' as const,
          label: entry.label,
          detail: entry.primary ?? entry.path,
          score,
          source: 'recent-workspaces',
          commandId: 'nexus.workspace.openPath',
          metadata: { path: entry.path }
        };
      })
      .filter(item => item.score > 0);
    return [...actionItems, ...recentItems];
  }
});

commandPalette.registerProvider({
  id: 'locale-switcher',
  getItems: query => {
    const normalizedQuery = query.toLowerCase();
    const baseKeywords = ['language', 'locale', 'display language'];
    const isLocaleSearch =
      !query ||
      baseKeywords.some(keyword => keyword.includes(normalizedQuery) || normalizedQuery.includes(keyword));

    const items = WORKBENCH_SUPPORTED_LOCALES.map(locale => {
      const label = i18nService.getLocaleDisplayName(locale);
      const score = query
        ? Math.max(
            fuzzyScore(query, label),
            fuzzyScore(query, locale),
            fuzzyScore(query, i18nService.translate('command.locale.switch', { fallback: 'Switch Display Language' }))
          )
        : 0.05;
      return {
        id: `locale:${locale}`,
        type: 'custom' as const,
        label,
        detail:
          i18nService.getLocale() === locale
            ? i18nService.translate('quickopen.locale.current', { fallback: 'Current language' })
            : i18nService.translate('quickopen.locale.select.detail', {
                fallback: 'Switch display language to {locale}',
                args: { locale: label }
              }),
        score,
        source: 'locale-switcher',
        commandId: 'nexus.locale.switch',
        metadata: { locale }
      };
    }).filter(item => (isLocaleSearch ? item.score >= 0.05 : item.score > 0));

    return items;
  }
});

commandRegistry.register({
  id: 'nexus.git.focus',
  title: 'Focus Source Control',
  category: 'View',
  handler: () => shell.setActiveSidebarView('view.git')
});

commandRegistry.register({
  id: 'nexus.git.show',
  title: 'Show Source Control Snapshot',
  category: 'Git',
  handler: () => gitStatusStore.getSnapshot()
});

commandRegistry.register({
  id: 'nexus.git.refreshStatus',
  title: 'Refresh Git Status',
  category: 'Git',
  handler: () => gitStatusStore.refresh(),
  enabled: () => Boolean(gitStatusStore.getSnapshot().repositoryId)
});

commandRegistry.register({
  id: 'nexus.git.stageAll',
  title: 'Stage All Changes',
  category: 'Git',
  handler: () => {
    const paths = gitStatusStore.getSnapshot().workingTree.map(item => item.path);
    return gitStatusStore.stage(paths);
  },
  enabled: () => gitStatusStore.getSnapshot().workingTree.length > 0
});

commandRegistry.register({
  id: 'nexus.git.unstageAll',
  title: 'Unstage All Changes',
  category: 'Git',
  handler: () => {
    const paths = gitStatusStore.getSnapshot().staged.map(item => item.path);
    return gitStatusStore.unstage(paths);
  },
  enabled: () => gitStatusStore.getSnapshot().staged.length > 0
});

commandRegistry.register({
  id: 'nexus.git.setCommitMessage',
  title: 'Set Commit Message',
  category: 'Git',
  detail: 'Updates the draft commit message in the SCM panel',
  handler: args => {
    const message = typeof args === 'string' ? args : (args as { message?: string })?.message;
    gitCommitStore.setMessage(message ?? '');
    return gitCommitStore.getSnapshot();
  }
});

commandRegistry.register({
  id: 'nexus.git.toggleSignOff',
  title: 'Toggle Sign-off',
  category: 'Git',
  handler: () => gitCommitStore.toggleSignOff()
});

commandRegistry.register({
  id: 'nexus.git.toggleAmend',
  title: 'Toggle Amend',
  category: 'Git',
  handler: () => gitCommitStore.toggleAmend()
});

commandRegistry.register({
  id: 'nexus.git.commit',
  title: 'Commit Staged Changes',
  category: 'Git',
  handler: async () => {
    const result = await gitCommitStore.commit();
    await gitStatusStore.refresh();
    await gitHistoryStore.refresh();
    return result;
  },
  enabled: () => Boolean(gitStatusStore.getSnapshot().repositoryId)
});

commandRegistry.register({
  id: 'nexus.git.refreshHistory',
  title: 'Refresh Git History',
  category: 'Git',
  handler: () => gitHistoryStore.refresh(),
  enabled: () => Boolean(gitHistoryStore.getSnapshot().repositoryId)
});

commandRegistry.register({
  id: 'nexus.commandPalette.show',
  title: t('command.commandPalette.show', 'Show Command Palette'),
  category: 'View',
  keybinding: { mac: 'Cmd+Shift+P', win: 'Ctrl+Shift+P' },
  handler: () => commandPalette.search('')
});

commandRegistry.register({
  id: 'nexus.panel.toggle',
  title: t('command.panel.toggle', 'Toggle Bottom Panel'),
  category: 'View',
  keybinding: { mac: 'Cmd+J', win: 'Ctrl+J' },
  handler: () => shell.togglePanelVisibility()
});

commandRegistry.register({
  id: 'nexus.sidebar.toggle',
  title: t('command.sidebar.toggle', 'Toggle Sidebar'),
  category: 'View',
  handler: () => shell.toggleSidebarCollapsed()
});

commandRegistry.register({
  id: 'nexus.notifications.show',
  title: t('command.notifications.show', 'Show Notifications'),
  category: 'View',
  handler: () => shell.layoutSnapshot().notifications
});

commandRegistry.register({
  id: 'nexus.status.encoding',
  title: t('command.status.encoding', 'Change File Encoding'),
  category: 'File',
  detail: t('command.status.encoding.detail', 'Returns the resolved default file encoding'),
  handler: () => settingsService.get<string>('files.encoding')
});

commandRegistry.register({
  id: 'nexus.locale.cycle',
  title: t('command.locale.cycle', 'Cycle Display Language'),
  category: 'Preferences',
  detail: t('command.locale.cycle.detail', 'Cycles between supported workbench languages'),
  handler: async () => {
    const current = i18nService.getLocale();
    const supported = [...WORKBENCH_SUPPORTED_LOCALES];
    const currentIndex = supported.findIndex(locale => locale === current);
    const nextLocale = supported[(currentIndex + 1) % supported.length] ?? supported[0];
    return commandRegistry.executeCommand('nexus.locale.switch', { locale: nextLocale });
  }
});

commandRegistry.register({
  id: 'nexus.locale.switch',
  title: t('command.locale.switch', 'Switch Display Language'),
  category: 'Preferences',
  detail: t(
    'command.locale.switch.detail',
    'Changes the active language and persists it to user settings'
  ),
  hidden: true,
  handler: async args => {
    const locale =
      typeof args === 'string'
        ? args
        : (args as { locale?: string } | undefined)?.locale;
    if (!locale) {
      throw new Error('Locale argument is required');
    }
    if (!WORKBENCH_SUPPORTED_LOCALES.includes(locale as (typeof WORKBENCH_SUPPORTED_LOCALES)[number])) {
      throw new Error(`Unsupported locale: ${locale}`);
    }
    settingsService.updateUserSetting('workbench.locale', locale);
    const localeLabel = i18nService.getLocaleDisplayName(locale);
    shell.pushNotification({
      title: t('notification.locale.updated.title', 'Display language updated'),
      message: t('notification.locale.updated.message', 'Nexus now uses {locale}.', { locale: localeLabel }),
      severity: 'success',
      expiresInMs: 3000
    });
    updateLocaleStatusItem();
    return settingsService.snapshot();
  }
});

commandRegistry.register({
  id: 'nexus.settings.inspect',
  title: 'Inspect Settings Snapshot',
  category: 'Preferences',
  hidden: true,
  handler: () => settingsService.snapshot()
});

commandRegistry.register({
  id: 'nexus.settings.update',
  title: 'Update User Setting',
  category: 'Preferences',
  hidden: true,
  handler: args => {
    if (!args || typeof args !== 'object') {
      throw new Error('Settings update requires an object payload');
    }
    if ('key' in args && typeof (args as { key?: unknown }).key === 'string') {
      return settingsService.updateUserSetting(
        (args as { key: string }).key,
        (args as { value?: unknown }).value
      );
    }
    return settingsService.updateUserSettings(args as Record<string, unknown>);
  }
});

commandRegistry.register({
  id: 'nexus.workspace.openPath',
  title: 'Open Workspace (Path)',
  category: 'File',
  handler: async args => {
    const argObject = typeof args === 'string' ? { path: args } : (args as { path?: string; forceNew?: boolean }) ?? {};
    if (!argObject.path) {
      throw new Error('Workspace path argument is required');
    }
    await workspaceService.openWorkspace(argObject.path, { forceNew: argObject.forceNew });
  }
});

commandRegistry.register({
  id: 'nexus.workspace.pickFolder',
  title: 'Open Workspace…',
  category: 'File',
  keybinding: { mac: 'Cmd+O', win: 'Ctrl+O' },
  handler: () => workspaceService.promptAndOpenWorkspace()
});

gitStatusStore.onDidChange(snapshot => updateGitStatusItem(snapshot));
updateGitStatusItem();
initializeGitStatus();

const restorePromise = workspaceStateService.restore().catch(error => {
  console.warn('[workspace-state] failed to restore workspace state', error);
  return false;
});

if (process.env.NEXUS_FOCUS_FILE) {
  shell.openEditor({
    title: process.env.NEXUS_FOCUS_FILE.split('/').pop() ?? 'Active File',
    resource: process.env.NEXUS_FOCUS_FILE
  });
} else {
  restorePromise.then(restored => {
    if (!restored) {
      shell.openEditor({ title: 'Welcome', resource: 'virtual://welcome', kind: 'preview' });
    }
  });
}

const snapshot = shell.layoutSnapshot();
console.log(
  '[workbench] layout bootstrap env=%s workspace=%s columns=%s rows=%s',
  env,
  workspaceIdentity,
  snapshot.gridTemplate.columns,
  snapshot.gridTemplate.rows
);
if (process.env.NEXUS_DEBUG_WORKBENCH === 'layout') {
  console.log(JSON.stringify(snapshot, null, 2));
}

function initializeGitStatus() {
  void gitRepositoryStore
    .refresh()
    .then(repos => {
      if (repos.length > 0) {
        const repoId = repos[0].id;
        gitStatusStore.setActiveRepository(repoId);
        gitCommitStore.setActiveRepository(repoId);
        gitHistoryStore.setActiveRepository(repoId);
        return gitHistoryStore.refresh();
      }
      gitStatusStore.setActiveRepository(undefined);
      gitCommitStore.setActiveRepository(undefined);
      gitHistoryStore.setActiveRepository(undefined);
      return undefined;
    })
    .catch(error => {
      console.warn('[git] failed to refresh repository list', error);
    });
}

function updateGitStatusItem(snapshot?: GitStatusSnapshot) {
  const branchLabel = snapshot?.branch ?? 'No Repository';
  const staged = snapshot?.staged.length ?? 0;
  const working = snapshot?.workingTree.length ?? 0;
  const statusLabel = staged || working ? `${branchLabel} (${staged}+${working})` : branchLabel;
  const tooltipSegments: string[] = [];
  if (snapshot?.upstream) {
    tooltipSegments.push(`Upstream: ${snapshot.upstream}`);
  }
  if ((snapshot?.ahead ?? 0) || (snapshot?.behind ?? 0)) {
    tooltipSegments.push(`Ahead ${snapshot?.ahead ?? 0} / Behind ${snapshot?.behind ?? 0}`);
  }
  if (staged || working) {
    tooltipSegments.push(`Staged: ${staged}, Unstaged: ${working}`);
  }
  if (!tooltipSegments.length) {
    tooltipSegments.push('Source control status');
  }
  shell.registerStatusItem({
    id: 'status.git',
    alignment: 'left',
    text: statusLabel,
    commandId: 'nexus.git.show',
    priority: 50,
    tooltip: tooltipSegments.join(' • ')
  });
}

function updateLocaleStatusItem() {
  const localeLabel = i18nService.getLocaleDisplayName(i18nService.getLocale());
  shell.registerStatusItem({
    id: 'status.locale',
    alignment: 'right',
    text: i18nService.translate('status.locale.current', {
      fallback: 'Language: {locale}',
      args: { locale: localeLabel }
    }),
    commandId: 'nexus.locale.cycle',
    priority: 6
  });
}

export {
  shell,
  commandRegistry,
  commandPalette,
  gitCommitStore,
  gitHistoryStore,
  gitStatusStore,
  settingsService,
  i18nService
};
