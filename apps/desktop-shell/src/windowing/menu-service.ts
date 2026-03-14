import { app, Menu, type MenuItemConstructorOptions, shell } from 'electron';
import type { BrowserWindow } from 'electron';
import type { WindowManager, WorkspaceLaunchRequest } from '../windowing/window-manager';
import type { KeymapService } from '../windowing/keymap-service';
import { pickWorkspaceDirectory } from '../workspace/workspace-dialog';

export class MenuService {
  private unsubscribe?: () => void;

  constructor(private readonly windowManager: WindowManager, private readonly keymapService: KeymapService) {}

  install() {
    this.rebuild();
    const listener = () => this.rebuild();
    this.keymapService.on('changed', listener);
    this.unsubscribe = () => this.keymapService.off('changed', listener);
  }

  dispose() {
    this.unsubscribe?.();
  }

  private rebuild() {
    if (!app.isReady()) return;
    const template = this.buildTemplate();
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private buildTemplate(): MenuItemConstructorOptions[] {
    const template: MenuItemConstructorOptions[] = [];
    if (process.platform === 'darwin') {
      template.push(this.buildMacAppMenu());
    }
    template.push(this.buildFileMenu());
    template.push(this.buildEditMenu());
    template.push(this.buildViewMenu());
    template.push(this.buildWindowMenu());
    template.push(this.buildHelpMenu());
    return template;
  }

  private buildMacAppMenu(): MenuItemConstructorOptions {
    return {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    };
  }

  private buildFileMenu(): MenuItemConstructorOptions {
    return {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: this.accelerator('nexus.window.new', 'CmdOrCtrl+Shift+N'),
          click: () => this.windowManager.createWindow()
        },
        {
          label: 'Open Workspace…',
          accelerator: this.accelerator('nexus.workspace.open', 'CmdOrCtrl+O'),
          click: (_item, focusedWindow) => this.showWorkspaceDialog(focusedWindow || undefined)
        },
        { type: 'separator' },
        {
          label: 'Close Window',
          accelerator: this.accelerator('nexus.window.close', 'CmdOrCtrl+W'),
          role: 'close'
        }
      ]
    };
  }

  private buildEditMenu(): MenuItemConstructorOptions {
    return {
      label: 'Edit',
      submenu: [
        { label: 'Undo', role: 'undo' },
        { label: 'Redo', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', role: 'cut' },
        { label: 'Copy', role: 'copy' },
        { label: 'Paste', role: 'paste' },
        { label: 'Select All', role: 'selectAll' }
      ]
    };
  }

  private buildViewMenu(): MenuItemConstructorOptions {
    return {
      label: 'View',
      submenu: [
        {
          label: 'Reload Window',
          accelerator: this.accelerator('nexus.window.reload', 'CmdOrCtrl+R'),
          click: (_item, focusedWindow) => focusedWindow?.reload()
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: this.accelerator('nexus.window.toggleDevtools', process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I'),
          click: (_item, focusedWindow) => focusedWindow?.webContents.toggleDevTools()
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: this.accelerator('nexus.zoom.in', 'CmdOrCtrl+='),
          role: 'zoomIn'
        },
        {
          label: 'Zoom Out',
          accelerator: this.accelerator('nexus.zoom.out', 'CmdOrCtrl+-'),
          role: 'zoomOut'
        },
        {
          label: 'Reset Zoom',
          accelerator: this.accelerator('nexus.zoom.reset', 'CmdOrCtrl+0'),
          role: 'resetZoom'
        },
        { type: 'separator' },
        {
          label: 'Toggle Full Screen',
          accelerator: this.accelerator('nexus.view.toggleFullScreen', process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11'),
          click: (_item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
            }
          }
        }
      ]
    };
  }

  private buildWindowMenu(): MenuItemConstructorOptions {
    const extraItems: MenuItemConstructorOptions[] = process.platform === 'darwin'
      ? [{ type: 'separator' }, { label: 'Bring All to Front', role: 'front' }]
      : [{ label: 'Close', role: 'close' }];
    return {
      label: 'Window',
      role: 'window',
      submenu: [
        { label: 'Minimize', role: 'minimize' },
        { label: 'Zoom', role: 'zoom' },
        ...extraItems
      ]
    };
  }

  private buildHelpMenu(): MenuItemConstructorOptions {
    return {
      label: 'Help',
      role: 'help',
      submenu: [
        {
          label: 'Nexus Documentation',
          accelerator: this.accelerator('nexus.help.toggleDocs', 'CmdOrCtrl+/'),
          click: () => shell.openExternal('https://nexus.dev/docs')
        }
      ]
    };
  }

  private accelerator(commandId: string, fallback: string) {
    return this.keymapService.getAccelerator(commandId, fallback);
  }

  private async showWorkspaceDialog(window?: BrowserWindow) {
    const selected = await pickWorkspaceDirectory(window);
    if (!selected) return;
    const request: WorkspaceLaunchRequest = { path: selected };
    this.windowManager.openWorkspace(request);
  }
}
