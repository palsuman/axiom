import { bootstrapPersistentWorkbenchShell } from '../shell/workbench-layout-store';
import { CommandRegistry } from '../commands/command-registry';
import { CommandPaletteService } from '../commands/command-palette';
import { I18nService, WORKBENCH_I18N_BUNDLES } from '../i18n/i18n-service';
import { WorkspaceService } from '../workspace/workspace-service';
import { WorkspaceStateService } from '../workspace/workspace-state-service';
import { GitCommitStore } from '../scm/git-commit-store';
import { GitHistoryStore } from '../scm/git-history-store';
import { GitRepositoryStore } from '../scm/git-repository-store';
import { GitStatusStore } from '../scm/git-status-store';
import { SettingsService } from '../settings/settings-service';
import { WorkspaceHotExitService } from '../workspace/workspace-hot-exit-service';
import type { ThemeRuntime } from '@nexus/platform/theming/theme-runtime';

type NexusBridge = typeof window.nexus | undefined;

export type WorkbenchBootstrapContext = {
  env: string;
  workspaceIdentity: string;
  workspaceBridge: NexusBridge;
  i18nService: I18nService;
  layoutHandle: ReturnType<typeof bootstrapPersistentWorkbenchShell>;
  shell: ReturnType<typeof bootstrapPersistentWorkbenchShell>['shell'];
  workspaceStateService: WorkspaceStateService;
  hotExitService: WorkspaceHotExitService;
  commandRegistry: CommandRegistry;
  commandPalette: CommandPaletteService;
  workspaceService: WorkspaceService;
  gitRepositoryStore: GitRepositoryStore;
  gitStatusStore: GitStatusStore;
  gitCommitStore: GitCommitStore;
  gitHistoryStore: GitHistoryStore;
  settingsService: SettingsService;
  themeRuntime: ThemeRuntime;
};

export function createWorkbenchBootstrapContext(): WorkbenchBootstrapContext {
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
  const themeRuntime = settingsService.getThemeRuntime();

  return {
    env,
    workspaceIdentity,
    workspaceBridge,
    i18nService,
    layoutHandle,
    shell,
    workspaceStateService,
    hotExitService,
    commandRegistry,
    commandPalette,
    workspaceService,
    gitRepositoryStore,
    gitStatusStore,
    gitCommitStore,
    gitHistoryStore,
    settingsService,
    themeRuntime
  };
}

export function disposeWorkbenchBootstrapContext(context: WorkbenchBootstrapContext) {
  context.workspaceStateService.dispose();
  context.layoutHandle.dispose();
  context.hotExitService.dispose();
}
