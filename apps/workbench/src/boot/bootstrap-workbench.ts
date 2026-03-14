import { createWorkbenchBootstrapContext, disposeWorkbenchBootstrapContext } from './workbench-bootstrap-context';
import { registerWorkbenchContributions } from './workbench-bootstrap-contributions';
import { registerWorkbenchCommands } from './workbench-bootstrap-commands';
import { startWorkbenchRuntime } from './workbench-bootstrap-runtime';

const context = createWorkbenchBootstrapContext();
const contributionBindings = registerWorkbenchContributions({
  shell: context.shell,
  commandPalette: context.commandPalette,
  workspaceService: context.workspaceService,
  gitStatusStore: context.gitStatusStore,
  i18nService: context.i18nService
});
registerWorkbenchCommands(context);
const runtimeHandle = startWorkbenchRuntime(context);

process.once('exit', () => {
  contributionBindings.dispose();
  runtimeHandle.dispose();
  disposeWorkbenchBootstrapContext(context);
});

const shell = context.shell;
const commandRegistry = context.commandRegistry;
const commandPalette = context.commandPalette;
const gitCommitStore = context.gitCommitStore;
const gitHistoryStore = context.gitHistoryStore;
const gitStatusStore = context.gitStatusStore;
const settingsService = context.settingsService;
const i18nService = context.i18nService;

export {
  context as workbenchBootstrapContext,
  contributionBindings as workbenchContributionBindings,
  shell,
  commandRegistry,
  commandPalette,
  gitCommitStore,
  gitHistoryStore,
  gitStatusStore,
  settingsService,
  i18nService
};
