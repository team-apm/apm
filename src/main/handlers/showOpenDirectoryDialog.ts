import { BrowserWindow, dialog } from 'electron';

/**
 * Show open directory dialog
 * @param {string} title - Dialog title
 * @param {string} defaultPath - Default path
 * @returns {Promise<string[]>} - Selected directory path
 */
async function showOpenDirectoryDialog(title: string, defaultPath: string) {
  const win = BrowserWindow.getFocusedWindow();
  const dir = await dialog.showOpenDialog(win, {
    title: title,
    defaultPath: defaultPath,
    properties: ['openDirectory'],
  });
  return dir.filePaths;
}

export default showOpenDirectoryDialog;
