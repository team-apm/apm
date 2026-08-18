import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  shell,
} from 'electron';
import log from 'electron-log/main';
import fs from 'fs-extra';
import path from 'node:path';
import { IPC_CHANNELS } from '../common/ipc';
import { isParent } from '../shared/apmPath';

const APP_PATH_NAMES = new Set([
  'home',
  'appData',
  'userData',
  'sessionData',
  'temp',
  'exe',
  'module',
  'desktop',
  'documents',
  'downloads',
  'music',
  'pictures',
  'videos',
  'recent',
  'logs',
  'crashDumps',
]);

/**
 * Registers the IPC handlers that do not depend on a specific window.
 */
export function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.GET_APP_NAME, () => {
    return app.name;
  });

  ipcMain.handle(IPC_CHANNELS.GET_APP_VERSION, () => {
    return app.getVersion();
  });

  ipcMain.handle(IPC_CHANNELS.APP_GET_PATH, (event, name) => {
    if (!APP_PATH_NAMES.has(name)) {
      throw new Error(`An invalid path name was requested: ${name}`);
    }
    return app.getPath(name as Parameters<typeof app.getPath>[0]);
  });

  ipcMain.handle(IPC_CHANNELS.APP_QUIT, () => {
    app.quit();
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_PATH, async (event, relativePath) => {
    const dataDir = path.join(app.getPath('userData'), 'Data/');
    const folderPath = path.join(dataDir, relativePath);
    // relativePath はリモート由来のパッケージ ID を含むため、データフォルダ外は拒否する
    if (!isParent(dataDir, folderPath)) {
      log.error(
        `Refused to open a path outside the data folder: ${relativePath}`,
      );
      return false;
    }
    const folderExists = fs.existsSync(folderPath);
    if (folderExists) await shell.openPath(folderPath);
    return folderExists;
  });

  ipcMain.handle(
    IPC_CHANNELS.OPEN_DIR_DIALOG,
    async (event, title, defaultPath) => {
      const win = BrowserWindow.getFocusedWindow();
      const dir = await dialog.showOpenDialog(win, {
        title: title,
        defaultPath: defaultPath,
        properties: ['openDirectory'],
      });
      return dir.filePaths;
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.OPEN_DIALOG,
    async (event, title, message, type) => {
      await dialog.showMessageBox({
        title: title,
        message: message,
        type: type,
      });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.OPEN_YES_NO_DIALOG,
    async (event, title, message) => {
      const win = BrowserWindow.getFocusedWindow();
      const response = await dialog.showMessageBox(win, {
        title: title,
        message: message,
        type: 'warning',
        buttons: ['はい', `いいえ`],
        cancelId: 1,
      });
      if (response.response === 0) {
        return true;
      } else {
        return false;
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_WRITE_TEXT, async (event, text) => {
    clipboard.writeText(text);
  });
}
