import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';

const dialogOptions: OpenDialogOptions = {
  properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
  message: 'Select a workspace folder',
  title: 'Open Workspace'
};

export async function pickWorkspaceDirectory(window?: BrowserWindow) {
  const result = window ? await dialog.showOpenDialog(window, dialogOptions) : await dialog.showOpenDialog(dialogOptions);
  if (result.canceled || !result.filePaths.length) {
    return undefined;
  }
  return result.filePaths[0];
}
