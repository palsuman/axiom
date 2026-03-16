import { fuzzyScore } from '../commands/fuzzy-match';
import { WORKBENCH_SUPPORTED_LOCALES, type I18nService, type LocalizedText } from '../i18n/i18n-service';
import type { GitStatusSnapshot } from '../scm/git-status-store';
import { createNotificationStatusItem } from '../shell/workbench-shell-status';
import { DEFAULT_ACTIVITY_ITEMS, type WorkbenchShell } from '../shell/workbench-shell';
import type { CommandPaletteService } from '../commands/command-palette';
import type { SettingsEditorService } from '../settings/settings-editor-service';
import type { LaunchConfigurationEditorService } from '../run-debug/launch-configuration-editor-service';
import type { PrivacyCenterService } from '../observability/privacy-center-service';
import type { WorkspaceService } from '../workspace/workspace-service';
import type { GitStatusStore } from '../scm/git-status-store';
import {
  createDefaultPanelActions,
  createProblemSummary,
  type PanelHostService
} from '../shell/panel-host-service';

export type WorkbenchContributionBindings = {
  dispose: () => void;
  updateGitStatusItem: (snapshot?: GitStatusSnapshot) => void;
};

export function registerWorkbenchContributions(options: {
  shell: WorkbenchShell;
  commandPalette: CommandPaletteService;
  workspaceService: WorkspaceService;
  gitStatusStore: GitStatusStore;
  i18nService: I18nService;
  settingsEditorService: SettingsEditorService;
  privacyCenterService: PrivacyCenterService;
  panelHostService: PanelHostService;
  launchConfigurationEditorService: LaunchConfigurationEditorService;
}): WorkbenchContributionBindings {
  registerWorkbenchStructure(options.shell, options.panelHostService);
  registerQuickOpenProviders(
    options.commandPalette,
    options.workspaceService,
    options.i18nService,
    options.settingsEditorService,
    options.privacyCenterService,
    options.launchConfigurationEditorService
  );
  options.shell.registerStatusItem({ id: 'status.encoding', alignment: 'right', text: 'UTF-8', priority: 5 });

  const updateLocaleStatusItem = () => {
    const localeLabel = options.i18nService.getLocaleDisplayName(options.i18nService.getLocale());
    options.shell.registerStatusItem({
      id: 'status.locale',
      alignment: 'right',
      text: options.i18nService.translate('status.locale.current', {
        fallback: 'Language: {locale}',
        args: { locale: localeLabel }
      }),
      commandId: 'nexus.locale.cycle',
      priority: 6
    });
  };

  const updateNotificationStatus = () => {
    options.shell.registerStatusItem(
      createNotificationStatusItem(options.i18nService, options.shell.getNotificationSnapshot())
    );
  };

  const updateGitStatusItem = (snapshot?: GitStatusSnapshot) => {
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
    options.shell.registerStatusItem({
      id: 'status.git',
      alignment: 'left',
      text: statusLabel,
      commandId: 'nexus.git.show',
      priority: 50,
      tooltip: tooltipSegments.join(' - ')
    });
  };

  const disposeGitListener = options.gitStatusStore.onDidChange(snapshot => updateGitStatusItem(snapshot));
  const disposeLocaleListener = options.i18nService.onDidChangeLocale(() => {
    updateLocaleStatusItem();
    updateNotificationStatus();
  });

  updateNotificationStatus();
  updateLocaleStatusItem();
  updateGitStatusItem(options.gitStatusStore.getSnapshot());

  return {
    dispose: () => {
      disposeGitListener();
      disposeLocaleListener();
    },
    updateGitStatusItem
  };
}

function registerWorkbenchStructure(shell: WorkbenchShell, panelHostService: PanelHostService) {
  DEFAULT_ACTIVITY_ITEMS.forEach(activity => shell.registerActivity(activity));
  shell.registerSidebarView({ id: 'view.explorer', title: 'Explorer', order: 1, containerId: 'activity.explorer' });
  shell.registerSidebarView({ id: 'view.search', title: 'Search', order: 2, containerId: 'activity.search' });
  shell.registerSidebarView({ id: 'view.git', title: 'Source Control', order: 3, containerId: 'activity.git' });
  shell.registerSidebarView({ id: 'view.run', title: 'Run & Debug', order: 4, containerId: 'activity.run' });

  panelHostService.registerContribution({
    id: 'panel.terminal',
    title: 'Terminal',
    order: 1,
    render: () => ({
      kind: 'terminal',
      title: 'Integrated Terminal',
      description: 'PTY-backed shell sessions appear here.',
      actions: createDefaultPanelActions()
    })
  });
  panelHostService.registerContribution({
    id: 'panel.output',
    title: 'Output',
    order: 2,
    render: context => ({
      kind: 'output',
      title: 'Output',
      channels: context.outputChannels,
      activeChannelId: context.activeOutputChannelId,
      actions: createDefaultPanelActions()
    })
  });
  panelHostService.registerContribution({
    id: 'panel.problems',
    title: 'Problems',
    order: 3,
    render: context => ({
      kind: 'problems',
      title: 'Problems',
      summary: createProblemSummary(context.problems),
      entries: context.problems,
      actions: createDefaultPanelActions()
    })
  });

  panelHostService.appendOutputEntry('workbench', 'Workbench', 'Panel host initialized.');
  panelHostService.appendOutputEntry('extensions', 'Extensions', 'No extension panels registered yet.');
  panelHostService.replaceProblems([]);
}

function registerQuickOpenProviders(
  commandPalette: CommandPaletteService,
  workspaceService: WorkspaceService,
  i18nService: I18nService,
  settingsEditorService: SettingsEditorService,
  privacyCenterService: PrivacyCenterService,
  launchConfigurationEditorService: LaunchConfigurationEditorService
) {
  void privacyCenterService;
  commandPalette.registerProvider({
    id: 'recent-workspaces',
    getItems: query => {
      const actionItems = [
        {
          id: 'workspace:open-picker',
          type: 'custom' as const,
          label: i18nService.format(localized('quickopen.workspace.open', 'Open Workspace...')),
          detail: i18nService.format(localized('quickopen.workspace.open.detail', 'Pick a folder to open')),
          score: query ? fuzzyScore(query, 'open workspace') : 1,
          source: 'workspace-action',
          commandId: 'nexus.workspace.pickFolder',
          metadata: {}
        }
      ];

      const recentItems = workspaceService
        .getRecentWorkspaces()
        .map(entry => ({
          id: `workspace:${entry.path}`,
          type: 'workspace' as const,
          label: entry.label,
          detail: entry.primary ?? entry.path,
          score: query ? fuzzyScore(query, entry.label) : 0.2,
          source: 'recent-workspaces',
          commandId: 'nexus.workspace.openPath',
          metadata: { path: entry.path }
        }))
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

      return WORKBENCH_SUPPORTED_LOCALES.map(locale => {
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
    }
  });

  commandPalette.registerProvider({
    id: 'run-configurations',
    getItems: query => {
      const snapshot = launchConfigurationEditorService.getSnapshot();
      const normalizedQuery = query.trim().toLowerCase();
      const actionItems: Array<{
        id: string;
        type: 'custom';
        label: string;
        detail: string;
        score: number;
        source: string;
        commandId: string;
        metadata: Record<string, unknown>;
      }> = [
        {
          id: 'run-config:open',
          type: 'custom',
          label: 'Open Launch Configurations',
          detail: 'Run & Debug',
          score: normalizedQuery ? fuzzyScore(normalizedQuery, 'open launch configurations run debug') : 0.16,
          source: 'run-config-action',
          commandId: 'nexus.run.configurations.open',
          metadata: { mode: 'form' }
        },
        {
          id: 'run-config:json',
          type: 'custom',
          label: 'Open launch.json',
          detail: 'Run & Debug',
          score: normalizedQuery ? fuzzyScore(normalizedQuery, 'open launch json run debug') : 0.15,
          source: 'run-config-action',
          commandId: 'nexus.run.configurations.openJson',
          metadata: {}
        }
      ];
      const primaryConfiguration = snapshot.configurations[0];
      if (primaryConfiguration) {
        actionItems.push({
          id: 'run-config:start',
          type: 'custom' as const,
          label: `Start ${primaryConfiguration.name}`,
          detail: 'Run & Debug',
          score: normalizedQuery ? fuzzyScore(normalizedQuery, `start debug ${primaryConfiguration.name}`) : 0.14,
          source: 'run-config-action',
          commandId: 'nexus.run.debug.start',
          metadata: {
            configurationName: primaryConfiguration.name
          }
        });
      }

      const configurationItems = snapshot.configurations
        .map(configuration => ({
          id: `run-config:${configuration.name}`,
          type: 'custom' as const,
          label: configuration.name,
          detail: `${configuration.type} • ${configuration.request}`,
          score: normalizedQuery
            ? Math.max(fuzzyScore(normalizedQuery, configuration.name), fuzzyScore(normalizedQuery, configuration.type))
            : 0.07,
          source: 'run-config-entry',
          commandId: 'nexus.run.configurations.open',
          metadata: { mode: 'form' }
        }))
        .filter(item => item.score > 0 || !normalizedQuery);

      return [...actionItems.filter(item => item.score > 0 || !normalizedQuery), ...configurationItems];
    }
  });

  commandPalette.registerProvider({
    id: 'settings-search',
    getItems: query => {
      const snapshot = settingsEditorService.getSnapshot();
      const normalizedQuery = query.trim().toLowerCase();
      const keywordScore = normalizedQuery ? fuzzyScore(normalizedQuery, 'settings preferences') : 0.05;
      const actionItems = [
        {
          id: 'settings:privacy:center',
          type: 'custom' as const,
          label: 'Open Privacy Center',
          detail: 'Preferences',
          score: normalizedQuery ? Math.max(keywordScore, fuzzyScore(normalizedQuery, 'privacy telemetry consent')) : 0.185,
          source: 'settings-action',
          commandId: 'nexus.privacy.center.open',
          metadata: {}
        },
        {
          id: 'settings:user:form',
          type: 'custom' as const,
          label: 'Open User Settings',
          detail: 'Preferences',
          score: normalizedQuery ? Math.max(keywordScore, fuzzyScore(normalizedQuery, 'user settings')) : 0.2,
          source: 'settings-action',
          commandId: 'nexus.settings.open',
          metadata: { scope: 'user', mode: 'form' }
        },
        {
          id: 'settings:user:json',
          type: 'custom' as const,
          label: 'Open User Settings (JSON)',
          detail: 'Preferences',
          score: normalizedQuery ? Math.max(keywordScore, fuzzyScore(normalizedQuery, 'user settings json')) : 0.19,
          source: 'settings-action',
          commandId: 'nexus.settings.openJson',
          metadata: { scope: 'user' }
        }
      ];

      if (snapshot.availableScopes.includes('workspace')) {
        actionItems.push({
          id: 'settings:workspace:form',
          type: 'custom' as const,
          label: 'Open Workspace Settings',
          detail: 'Preferences',
          score: normalizedQuery ? Math.max(keywordScore, fuzzyScore(normalizedQuery, 'workspace settings')) : 0.18,
          source: 'settings-action',
          commandId: 'nexus.settings.open',
          metadata: { scope: 'workspace', mode: 'form' }
        });
        actionItems.push({
          id: 'settings:workspace:json',
          type: 'custom' as const,
          label: 'Open Workspace Settings (JSON)',
          detail: 'Preferences',
          score: normalizedQuery
            ? Math.max(keywordScore, fuzzyScore(normalizedQuery, 'workspace settings json'))
            : 0.17,
          source: 'settings-action',
          commandId: 'nexus.settings.openJson',
          metadata: { scope: 'workspace' }
        });
      }

      const settingItems = settingsEditorService
        .querySections(snapshot.activeScope, query)
        .flatMap(section =>
          section.entries.map(entry => ({
            id: `setting:${entry.key}`,
            type: 'custom' as const,
            label: entry.title,
            detail: `${section.title} • ${entry.key}`,
            description: entry.description,
            score: normalizedQuery
              ? Math.max(fuzzyScore(normalizedQuery, entry.title), fuzzyScore(normalizedQuery, entry.key))
              : 0.08,
            source: 'settings-entry',
            commandId: 'nexus.settings.open',
            metadata: { scope: snapshot.activeScope, mode: 'form', focusKey: entry.key }
          }))
        )
        .filter(item => item.score > 0 || !normalizedQuery);

      return [...actionItems.filter(item => item.score > 0 || !normalizedQuery), ...settingItems];
    }
  });
}

function localized(key: string, fallback: string, args?: Record<string, string | number>): LocalizedText {
  return { key, fallback, args };
}
