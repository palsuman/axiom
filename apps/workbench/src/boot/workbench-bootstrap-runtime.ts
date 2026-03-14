import { TerminalHost } from '../terminal/terminal-host';
import { toTerminalThemeDefinition } from '@nexus/platform/theming/theme-runtime';
import type { WorkbenchBootstrapContext } from './workbench-bootstrap-context';

export function startWorkbenchRuntime(context: WorkbenchBootstrapContext) {
  const cleanupHandlers: Array<() => void> = [];
  let terminalHost: TerminalHost | undefined;

  cleanupHandlers.push(mountTerminalSurface(context, host => {
    terminalHost = host;
  }));
  cleanupHandlers.push(bindHotExitFlush(context));
  cleanupHandlers.push(bindProcessLifecycle(context, () => terminalHost));

  void context.workspaceService.refreshRecentWorkspaces().catch(() => undefined);
  initializeGitRuntime(context);
  restoreWorkbenchSurface(context);
  logWorkbenchLayout(context);

  return {
    dispose: () => {
      while (cleanupHandlers.length > 0) {
        const cleanup = cleanupHandlers.pop();
        cleanup?.();
      }
      terminalHost?.dispose();
    }
  };
}

function initializeGitRuntime(context: WorkbenchBootstrapContext) {
  void context.gitRepositoryStore
    .refresh()
    .then(repos => {
      if (repos.length > 0) {
        const repoId = repos[0].id;
        context.gitStatusStore.setActiveRepository(repoId);
        context.gitCommitStore.setActiveRepository(repoId);
        context.gitHistoryStore.setActiveRepository(repoId);
        return context.gitHistoryStore.refresh();
      }
      context.gitStatusStore.setActiveRepository(undefined);
      context.gitCommitStore.setActiveRepository(undefined);
      context.gitHistoryStore.setActiveRepository(undefined);
      return undefined;
    })
    .catch(error => {
      console.warn('[git] failed to refresh repository list', error);
    });
}

function restoreWorkbenchSurface(context: WorkbenchBootstrapContext) {
  const restorePromise = context.workspaceStateService.restore().catch(error => {
    console.warn('[workspace-state] failed to restore workspace state', error);
    return false;
  });

  if (process.env.NEXUS_FOCUS_FILE) {
    context.shell.openEditor({
      title: process.env.NEXUS_FOCUS_FILE.split('/').pop() ?? 'Active File',
      resource: process.env.NEXUS_FOCUS_FILE
    });
    return;
  }

  restorePromise.then(restored => {
    if (!restored) {
      context.shell.openEditor({ title: 'Welcome', resource: 'virtual://welcome', kind: 'preview' });
    }
  });
}

function logWorkbenchLayout(context: WorkbenchBootstrapContext) {
  const snapshot = context.shell.layoutSnapshot();
  console.log(
    '[workbench] layout bootstrap env=%s workspace=%s columns=%s rows=%s',
    context.env,
    context.workspaceIdentity,
    snapshot.gridTemplate.columns,
    snapshot.gridTemplate.rows
  );
  if (process.env.NEXUS_DEBUG_WORKBENCH === 'layout') {
    console.log(JSON.stringify(snapshot, null, 2));
  }
}

function bindHotExitFlush(context: WorkbenchBootstrapContext) {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => undefined;
  }
  const onBeforeUnload = () => {
    void context.hotExitService.flushNow();
  };
  window.addEventListener('beforeunload', onBeforeUnload);
  return () => {
    window.removeEventListener('beforeunload', onBeforeUnload);
  };
}

function bindProcessLifecycle(
  context: WorkbenchBootstrapContext,
  resolveTerminalHost: () => TerminalHost | undefined
) {
  const onExit = () => {
    context.workspaceStateService.dispose();
    context.layoutHandle.dispose();
    resolveTerminalHost()?.dispose();
    context.hotExitService.dispose();
  };
  process.once('exit', onExit);
  return () => {
    process.removeListener('exit', onExit);
  };
}

function mountTerminalSurface(
  context: WorkbenchBootstrapContext,
  setTerminalHost: (host: TerminalHost | undefined) => void
) {
  if (typeof document === 'undefined') {
    return () => undefined;
  }

  const disposeDrop = context.workspaceService.registerDropTarget(document.body);
  let mounted = false;
  let terminalHost: TerminalHost | undefined;

  const mountTerminal = () => {
    if (mounted || !document.body) {
      return;
    }
    mounted = true;
    const container = document.createElement('div');
    container.id = 'nexus-terminal-host';
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '0',
      left: 'var(--nexus-activity-bar-width, 56px)',
      right: '0',
      height: '240px',
      background: context.shell.getThemeTokens()['--nexus-panel-background'] ?? '#1e1e1e',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      zIndex: '10'
    });
    document.body.appendChild(container);
    terminalHost = new TerminalHost({
      container,
      theme: toTerminalThemeDefinition(context.themeRuntime.getSnapshot())
    });
    terminalHost.bindThemeRuntime(context.themeRuntime);
    context.hotExitService.attachTerminalHost(terminalHost);
    setTerminalHost(terminalHost);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountTerminal, { once: true });
  } else {
    mountTerminal();
  }

  return () => {
    disposeDrop();
    terminalHost?.dispose();
    setTerminalHost(undefined);
  };
}
