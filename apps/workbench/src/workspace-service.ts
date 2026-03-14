import type { OpenWorkspacePayload, RecentWorkspaceEntry, PickWorkspaceResponse } from '@nexus/contracts/ipc';

type WorkspaceBridge = {
  openWorkspace(payload: OpenWorkspacePayload): Promise<unknown>;
  getRecentWorkspaces(): Promise<RecentWorkspaceEntry[]>;
  pickWorkspaceFolder(): Promise<PickWorkspaceResponse>;
} | undefined;

export class WorkspaceService {
  private recents: RecentWorkspaceEntry[] = [];

  constructor(private readonly bridge: WorkspaceBridge = WorkspaceService.resolveBridge()) {}

  async openWorkspace(path: string, options?: { forceNew?: boolean }) {
    if (!path || typeof path !== 'string') {
      throw new Error('Workspace path is required');
    }
    const bridge = this.assertBridge();
    await bridge.openWorkspace({ path, forceNew: options?.forceNew });
    await this.refreshRecentWorkspaces();
  }

  async refreshRecentWorkspaces() {
    if (!this.bridge) {
      this.recents = [];
      return this.getRecentWorkspaces();
    }
    this.recents = await this.bridge.getRecentWorkspaces();
    return this.getRecentWorkspaces();
  }

  getRecentWorkspaces() {
    return [...this.recents];
  }

  async promptAndOpenWorkspace(options?: { forceNew?: boolean }) {
    const bridge = this.assertBridge();
    const result = await bridge.pickWorkspaceFolder();
    if (!result?.path) return false;
    await this.openWorkspace(result.path, options);
    return true;
  }

  registerDropTarget(target: HTMLElement, options?: { forceNew?: boolean }) {
    const onDragOver = (event: DragEvent) => {
      if (this.extractWorkspacePath(event.dataTransfer)) {
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy';
        }
      }
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      const path = this.extractWorkspacePath(event.dataTransfer);
      if (path) {
        this.openWorkspace(path, options).catch(error => {
          console.warn('Failed to open dropped workspace', error);
        });
      }
    };
    target.addEventListener('dragover', onDragOver);
    target.addEventListener('drop', onDrop);
    return () => {
      target.removeEventListener('dragover', onDragOver);
      target.removeEventListener('drop', onDrop);
    };
  }

  private extractWorkspacePath(dataTransfer?: DataTransfer | null) {
    if (!dataTransfer) return undefined;
    const items = Array.from(dataTransfer.items ?? []);
    for (const item of items) {
      const path = this.pathFromItem(item);
      if (path) return path;
    }
    const files = Array.from(dataTransfer.files ?? []);
    for (const file of files) {
      const filePath = (file as File & { path?: string }).path;
      if (filePath) return filePath;
    }
    return undefined;
  }

  private pathFromItem(item: DataTransferItem) {
    if (item.kind !== 'file') return undefined;
    const anyItem = item as DataTransferItem & { webkitGetAsEntry?: () => { isDirectory?: boolean } | null };
    const entry = typeof anyItem.webkitGetAsEntry === 'function' ? anyItem.webkitGetAsEntry() : undefined;
    if (entry && 'isDirectory' in entry && entry.isDirectory === false) {
      return undefined;
    }
    const file = item.getAsFile();
    if (!file) return undefined;
    return (file as File & { path?: string }).path;
  }

  private assertBridge() {
    if (!this.bridge) {
      throw new Error('Workspace bridge is not available in this environment');
    }
    return this.bridge;
  }

  private static resolveBridge(): WorkspaceBridge {
    if (typeof window !== 'undefined' && window.nexus) {
      return window.nexus;
    }
    return undefined;
  }
}
