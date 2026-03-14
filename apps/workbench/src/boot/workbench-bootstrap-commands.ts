import { WORKBENCH_SUPPORTED_LOCALES, type LocalizedText } from '../i18n/i18n-service';
import type { WorkbenchBootstrapContext } from './workbench-bootstrap-context';

export function registerWorkbenchCommands(context: WorkbenchBootstrapContext) {
  const t = (key: string, fallback: string, args?: Record<string, string | number>): LocalizedText => ({
    key,
    fallback,
    args
  });

  context.commandRegistry.register({
    id: 'nexus.run.focus',
    title: 'Focus Run & Debug',
    category: 'View',
    handler: () => context.shell.setActiveSidebarView('view.run')
  });

  context.commandRegistry.register({
    id: 'nexus.run.configurations.open',
    title: 'Open Launch Configurations',
    category: 'Run & Debug',
    handler: args => {
      const payload = (typeof args === 'object' && args ? args : {}) as {
        mode?: 'form' | 'json';
      };
      return context.launchConfigurationEditorService.open({
        mode: payload.mode ?? 'form'
      });
    }
  });

  context.commandRegistry.register({
    id: 'nexus.run.configurations.openJson',
    title: 'Open launch.json',
    category: 'Run & Debug',
    handler: () =>
      context.launchConfigurationEditorService.open({
        mode: 'json'
      })
  });

  context.commandRegistry.register({
    id: 'nexus.run.configurations.refresh',
    title: 'Refresh Launch Configurations',
    category: 'Run & Debug',
    handler: () => context.launchConfigurationEditorService.refresh()
  });

  context.commandRegistry.register({
    id: 'nexus.run.configurations.inspect',
    title: 'Inspect Launch Configuration Snapshot',
    category: 'Run & Debug',
    hidden: true,
    handler: () => context.launchConfigurationEditorService.getSnapshot()
  });

  context.commandRegistry.register({
    id: 'nexus.run.debug.start',
    title: 'Start Debug Session',
    category: 'Run & Debug',
    handler: args => {
      const payload = (typeof args === 'object' && args ? args : {}) as {
        configurationName?: string;
        configurationIndex?: number;
        stopOnEntry?: boolean;
      };
      return context.debugSessionStore.start({
        configurationName: payload.configurationName,
        configurationIndex: payload.configurationIndex,
        stopOnEntry: payload.stopOnEntry
      });
    },
    enabled: () => context.launchConfigurationEditorService.getSnapshot().configurations.length > 0
  });

  context.commandRegistry.register({
    id: 'nexus.run.debug.stop',
    title: 'Stop Debug Session',
    category: 'Run & Debug',
    handler: () => {
      const session = context.debugSessionStore.getSnapshot().session;
      if (!session) {
        throw new Error('No active debug session to stop');
      }
      return context.debugSessionStore.stop({ sessionId: session.sessionId, terminateDebuggee: true });
    },
    enabled: () => {
      const session = context.debugSessionStore.getSnapshot().session;
      return Boolean(session && session.state !== 'terminated' && session.state !== 'failed');
    }
  });

  context.commandRegistry.register({
    id: 'nexus.run.debug.inspect',
    title: 'Inspect Debug Session Snapshot',
    category: 'Run & Debug',
    hidden: true,
    handler: () => context.debugSessionStore.getSnapshot()
  });

  context.commandRegistry.register({
    id: 'nexus.git.focus',
    title: 'Focus Source Control',
    category: 'View',
    handler: () => context.shell.setActiveSidebarView('view.git')
  });

  context.commandRegistry.register({
    id: 'nexus.git.show',
    title: 'Show Source Control Snapshot',
    category: 'Git',
    handler: () => context.gitStatusStore.getSnapshot()
  });

  context.commandRegistry.register({
    id: 'nexus.git.refreshStatus',
    title: 'Refresh Git Status',
    category: 'Git',
    handler: () => context.gitStatusStore.refresh(),
    enabled: () => Boolean(context.gitStatusStore.getSnapshot().repositoryId)
  });

  context.commandRegistry.register({
    id: 'nexus.git.stageAll',
    title: 'Stage All Changes',
    category: 'Git',
    handler: () => {
      const paths = context.gitStatusStore.getSnapshot().workingTree.map(item => item.path);
      return context.gitStatusStore.stage(paths);
    },
    enabled: () => context.gitStatusStore.getSnapshot().workingTree.length > 0
  });

  context.commandRegistry.register({
    id: 'nexus.git.unstageAll',
    title: 'Unstage All Changes',
    category: 'Git',
    handler: () => {
      const paths = context.gitStatusStore.getSnapshot().staged.map(item => item.path);
      return context.gitStatusStore.unstage(paths);
    },
    enabled: () => context.gitStatusStore.getSnapshot().staged.length > 0
  });

  context.commandRegistry.register({
    id: 'nexus.git.setCommitMessage',
    title: 'Set Commit Message',
    category: 'Git',
    detail: 'Updates the draft commit message in the SCM panel',
    handler: args => {
      const message = typeof args === 'string' ? args : (args as { message?: string })?.message;
      context.gitCommitStore.setMessage(message ?? '');
      return context.gitCommitStore.getSnapshot();
    }
  });

  context.commandRegistry.register({
    id: 'nexus.git.toggleSignOff',
    title: 'Toggle Sign-off',
    category: 'Git',
    handler: () => context.gitCommitStore.toggleSignOff()
  });

  context.commandRegistry.register({
    id: 'nexus.git.toggleAmend',
    title: 'Toggle Amend',
    category: 'Git',
    handler: () => context.gitCommitStore.toggleAmend()
  });

  context.commandRegistry.register({
    id: 'nexus.git.commit',
    title: 'Commit Staged Changes',
    category: 'Git',
    handler: async () => {
      const result = await context.gitCommitStore.commit();
      await context.gitStatusStore.refresh();
      await context.gitHistoryStore.refresh();
      return result;
    },
    enabled: () => Boolean(context.gitStatusStore.getSnapshot().repositoryId)
  });

  context.commandRegistry.register({
    id: 'nexus.git.refreshHistory',
    title: 'Refresh Git History',
    category: 'Git',
    handler: () => context.gitHistoryStore.refresh(),
    enabled: () => Boolean(context.gitHistoryStore.getSnapshot().repositoryId)
  });

  context.commandRegistry.register({
    id: 'nexus.commandPalette.show',
    title: t('command.commandPalette.show', 'Show Command Palette'),
    category: 'View',
    keybinding: { mac: 'Cmd+Shift+P', win: 'Ctrl+Shift+P' },
    handler: () => context.commandPalette.search('')
  });

  context.commandRegistry.register({
    id: 'nexus.panel.toggle',
    title: t('command.panel.toggle', 'Toggle Bottom Panel'),
    category: 'View',
    keybinding: { mac: 'Cmd+J', win: 'Ctrl+J' },
    handler: () => context.shell.togglePanelVisibility()
  });

  context.commandRegistry.register({
    id: 'nexus.sidebar.toggle',
    title: t('command.sidebar.toggle', 'Toggle Sidebar'),
    category: 'View',
    handler: () => context.shell.toggleSidebarCollapsed()
  });

  context.commandRegistry.register({
    id: 'nexus.notifications.show',
    title: t('command.notifications.show', 'Show Notifications'),
    category: 'View',
    handler: () => context.shell.layoutSnapshot().notifications
  });

  context.commandRegistry.register({
    id: 'nexus.status.encoding',
    title: t('command.status.encoding', 'Change File Encoding'),
    category: 'File',
    detail: t('command.status.encoding.detail', 'Returns the resolved default file encoding'),
    handler: () => context.settingsService.get<string>('files.encoding')
  });

  context.commandRegistry.register({
    id: 'nexus.settings.open',
    title: t('command.settings.open', 'Open Settings'),
    category: 'Preferences',
    keybinding: { mac: 'Cmd+,', win: 'Ctrl+,' },
    handler: args => {
      const payload = (typeof args === 'object' && args ? args : {}) as {
        scope?: 'user' | 'workspace';
        mode?: 'form' | 'json';
        query?: string;
        focusKey?: string;
      };
      return context.settingsEditorService.open({
        scope: payload.scope,
        mode: payload.mode ?? 'form',
        query: payload.query,
        focusKey: payload.focusKey
      });
    }
  });

  context.commandRegistry.register({
    id: 'nexus.settings.openJson',
    title: t('command.settings.openJson', 'Open Settings (JSON)'),
    category: 'Preferences',
    handler: args => {
      const payload = (typeof args === 'object' && args ? args : {}) as {
        scope?: 'user' | 'workspace';
      };
      return context.settingsEditorService.open({
        scope: payload.scope,
        mode: 'json'
      });
    }
  });

  context.commandRegistry.register({
    id: 'nexus.locale.cycle',
    title: t('command.locale.cycle', 'Cycle Display Language'),
    category: 'Preferences',
    detail: t('command.locale.cycle.detail', 'Cycles between supported workbench languages'),
    handler: async () => {
      const current = context.i18nService.getLocale();
      const supported = [...WORKBENCH_SUPPORTED_LOCALES];
      const currentIndex = supported.findIndex(locale => locale === current);
      const nextLocale = supported[(currentIndex + 1) % supported.length] ?? supported[0];
      return context.commandRegistry.executeCommand('nexus.locale.switch', { locale: nextLocale });
    }
  });

  context.commandRegistry.register({
    id: 'nexus.locale.switch',
    title: t('command.locale.switch', 'Switch Display Language'),
    category: 'Preferences',
    detail: t(
      'command.locale.switch.detail',
      'Changes the active language and persists it to user settings'
    ),
    hidden: true,
    handler: async args => {
      const locale = typeof args === 'string' ? args : (args as { locale?: string } | undefined)?.locale;
      if (!locale) {
        throw new Error('Locale argument is required');
      }
      if (!WORKBENCH_SUPPORTED_LOCALES.includes(locale as (typeof WORKBENCH_SUPPORTED_LOCALES)[number])) {
        throw new Error(`Unsupported locale: ${locale}`);
      }
      context.settingsService.updateUserSetting('workbench.locale', locale);
      const localeLabel = context.i18nService.getLocaleDisplayName(locale);
      context.shell.pushNotification({
        title: t('notification.locale.updated.title', 'Display language updated'),
        message: t('notification.locale.updated.message', 'Nexus now uses {locale}.', { locale: localeLabel }),
        severity: 'success',
        expiresInMs: 3000
      });
      return context.settingsService.snapshot();
    }
  });

  context.commandRegistry.register({
    id: 'nexus.settings.inspect',
    title: 'Inspect Settings Snapshot',
    category: 'Preferences',
    hidden: true,
    handler: () => context.settingsService.snapshot()
  });

  context.commandRegistry.register({
    id: 'nexus.settings.update',
    title: 'Update User Setting',
    category: 'Preferences',
    hidden: true,
    handler: args => {
      if (!args || typeof args !== 'object') {
        throw new Error('Settings update requires an object payload');
      }
      if ('key' in args && typeof (args as { key?: unknown }).key === 'string') {
        return context.settingsService.updateUserSetting(
          (args as { key: string }).key,
          (args as { value?: unknown }).value
        );
      }
      return context.settingsService.updateUserSettings(args as Record<string, unknown>);
    }
  });

  context.commandRegistry.register({
    id: 'nexus.settings.editor.inspect',
    title: 'Inspect Settings Editor Snapshot',
    category: 'Preferences',
    hidden: true,
    handler: () => context.settingsEditorService.getSnapshot()
  });

  context.commandRegistry.register({
    id: 'nexus.settings.editor.json',
    title: 'Apply Settings JSON Draft',
    category: 'Preferences',
    hidden: true,
    handler: args => {
      if (!args || typeof args !== 'object') {
        throw new Error('Settings JSON update requires an object payload');
      }
      const payload = args as { text?: string; scope?: 'user' | 'workspace' };
      if (typeof payload.text !== 'string') {
        throw new Error('Settings JSON update requires a string text payload');
      }
      return context.settingsEditorService.updateJsonText(payload.text, payload.scope ?? 'user');
    }
  });

  context.commandRegistry.register({
    id: 'nexus.settings.editor.update',
    title: 'Update Scoped Setting',
    category: 'Preferences',
    hidden: true,
    handler: args => {
      if (!args || typeof args !== 'object') {
        throw new Error('Scoped settings update requires an object payload');
      }
      const payload = args as { key?: string; value?: unknown; scope?: 'user' | 'workspace' };
      if (typeof payload.key !== 'string') {
        throw new Error('Scoped settings update requires a string key');
      }
      return context.settingsEditorService.updateSetting(payload.key, payload.value, payload.scope ?? 'user');
    }
  });

  context.commandRegistry.register({
    id: 'nexus.workspace.openPath',
    title: 'Open Workspace (Path)',
    category: 'File',
    handler: async args => {
      const argObject =
        typeof args === 'string' ? { path: args } : (args as { path?: string; forceNew?: boolean }) ?? {};
      if (!argObject.path) {
        throw new Error('Workspace path argument is required');
      }
      await context.workspaceService.openWorkspace(argObject.path, { forceNew: argObject.forceNew });
    }
  });

  context.commandRegistry.register({
    id: 'nexus.workspace.pickFolder',
    title: 'Open Workspace...',
    category: 'File',
    keybinding: { mac: 'Cmd+O', win: 'Ctrl+O' },
    handler: () => context.workspaceService.promptAndOpenWorkspace()
  });
}
