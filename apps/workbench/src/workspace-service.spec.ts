import type { RecentWorkspaceEntry } from '@nexus/contracts/ipc';
import { WorkspaceService } from './workspace-service';

const sampleRecents: RecentWorkspaceEntry[] = [
  { path: '/repo/app.nexus-workspace.json', label: 'app', lastOpenedAt: Date.now(), primary: '/repo/app', roots: ['/repo/app'] }
];

describe('WorkspaceService', () => {
  it('refreshes and returns recent workspaces', async () => {
    const bridge = buildBridge();
    const service = new WorkspaceService(bridge);
    await service.refreshRecentWorkspaces();
    expect(service.getRecentWorkspaces().length).toBe(1);
    expect(service.getRecentWorkspaces()[0].label).toBe('app');
  });

  it('opens workspace via bridge and rehydrates recents', async () => {
    const bridge = buildBridge();
    const service = new WorkspaceService(bridge);
    await service.openWorkspace('/repo/app');
    expect(bridge.openWorkspace).toHaveBeenCalledWith({ path: '/repo/app', forceNew: undefined });
    expect(bridge.getRecentWorkspaces).toHaveBeenCalled();
  });

  it('prompts for workspace and opens when user selects folder', async () => {
    const bridge = buildBridge();
    bridge.pickWorkspaceFolder.mockResolvedValue({ path: '/pick/project' });
    const service = new WorkspaceService(bridge);
    const result = await service.promptAndOpenWorkspace();
    expect(result).toBe(true);
    expect(bridge.openWorkspace).toHaveBeenCalledWith({ path: '/pick/project', forceNew: undefined });
  });

  it('ignores prompt when user cancels selection', async () => {
    const bridge = buildBridge();
    bridge.pickWorkspaceFolder.mockResolvedValue({});
    const service = new WorkspaceService(bridge);
    const result = await service.promptAndOpenWorkspace();
    expect(result).toBe(false);
    expect(bridge.openWorkspace).not.toHaveBeenCalled();
  });

  it('registers drop targets and opens dropped workspace directory', async () => {
    const bridge = buildBridge();
    const service = new WorkspaceService(bridge);
    const listeners: Record<string, ((event: DragEvent) => void)[]> = {};
    const target = {
      addEventListener: jest.fn((type: string, listener: EventListener) => {
        listeners[type] = listeners[type] ?? [];
        listeners[type].push(listener as (event: DragEvent) => void);
      }),
      removeEventListener: jest.fn((type: string, listener: EventListener) => {
        const group = listeners[type];
        if (!group) return;
        listeners[type] = group.filter(item => item !== listener);
      })
    } as unknown as HTMLElement;
    service.registerDropTarget(target);
    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        items: [
          {
            kind: 'file',
            getAsFile: () => ({ path: '/repo/app' }),
            webkitGetAsEntry: () => ({ isDirectory: true })
          }
        ],
        files: [{ path: '/repo/app' }],
        dropEffect: 'none'
      }
    } as unknown as DragEvent;
    listeners.drop?.forEach(listener => listener(dropEvent));
    await Promise.resolve();
    expect(bridge.openWorkspace).toHaveBeenCalledWith({ path: '/repo/app', forceNew: undefined });
  });
});

function buildBridge() {
  return {
    openWorkspace: jest.fn().mockResolvedValue(true),
    getRecentWorkspaces: jest.fn().mockResolvedValue(sampleRecents),
    pickWorkspaceFolder: jest.fn().mockResolvedValue({ path: '/tmp/default' })
  };
}
