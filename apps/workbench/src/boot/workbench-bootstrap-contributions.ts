import { fuzzyScore } from '../commands/fuzzy-match';
import { WORKBENCH_SUPPORTED_LOCALES, type I18nService, type LocalizedText } from '../i18n/i18n-service';
import type { GitStatusSnapshot } from '../scm/git-status-store';
import { createNotificationStatusItem } from '../shell/workbench-shell-status';
import { DEFAULT_ACTIVITY_ITEMS, type WorkbenchShell } from '../shell/workbench-shell';
import type { CommandPaletteService } from '../commands/command-palette';
import type { WorkspaceService } from '../workspace/workspace-service';
import type { GitStatusStore } from '../scm/git-status-store';

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
}): WorkbenchContributionBindings {
  registerWorkbenchStructure(options.shell);
  registerQuickOpenProviders(options.commandPalette, options.workspaceService, options.i18nService);
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

function registerWorkbenchStructure(shell: WorkbenchShell) {
  DEFAULT_ACTIVITY_ITEMS.forEach(activity => shell.registerActivity(activity));
  shell.registerSidebarView({ id: 'view.explorer', title: 'Explorer', order: 1, containerId: 'activity.explorer' });
  shell.registerSidebarView({ id: 'view.search', title: 'Search', order: 2, containerId: 'activity.search' });
  shell.registerSidebarView({ id: 'view.git', title: 'Source Control', order: 3, containerId: 'activity.git' });
  shell.registerPanelView({ id: 'panel.terminal', title: 'Terminal', order: 1 });
  shell.registerPanelView({ id: 'panel.output', title: 'Output', order: 2 });
}

function registerQuickOpenProviders(
  commandPalette: CommandPaletteService,
  workspaceService: WorkspaceService,
  i18nService: I18nService
) {
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
}

function localized(key: string, fallback: string, args?: Record<string, string | number>): LocalizedText {
  return { key, fallback, args };
}
