import { app, BrowserWindow } from 'electron';
import path from 'node:path';

const icon =
  process.platform === 'linux'
    ? path.join(__dirname, '../icon/apm1024.png')
    : undefined;

export type OpenBrowserResult = {
  savePath: string;
  history: string[];
} | null;

/**
 * Opens a modal browser window and waits for the user to download a file.
 * 旧 windows.ts の OPEN_BROWSER ハンドラと同一の挙動。ウィンドウが閉じられたら
 * null(キャンセル)を返す。
 * @param {BrowserWindow} parent - The parent (main) window.
 * @param {string} url - The URL to open.
 * @param {'core' | 'package'} type - The subdirectory in the data folder to save the file.
 * @returns {Promise<OpenBrowserResult>} The download result, or null if canceled.
 */
export function openBrowser(
  parent: BrowserWindow,
  url: string,
  type: 'core' | 'package',
): Promise<OpenBrowserResult> {
  const browserWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 240,
    minHeight: 320,
    webPreferences: { sandbox: true },
    parent,
    modal: true,
    icon: icon,
  });

  parent.once('closed', () => {
    if (!browserWindow.isDestroyed()) {
      browserWindow.destroy();
    }
  });

  void browserWindow.loadURL(url);

  return new Promise((resolve) => {
    const history: string[] = [];

    browserWindow.webContents.on('did-navigate', (e, url) => {
      history.push(url);
    });

    browserWindow.webContents.session.once('will-download', (event, item) => {
      if (!browserWindow.isDestroyed()) browserWindow.hide();

      const ext = path.extname(item.getFilename());
      const dir = path.join(app.getPath('userData'), 'Data');
      if (['.zip', '.lzh', '.7z', '.rar'].includes(ext)) {
        item.setSavePath(path.join(dir, type, 'archive/', item.getFilename()));
      } else {
        item.setSavePath(path.join(dir, type, item.getFilename()));
      }

      item.once('done', () => {
        history.push(...item.getURLChain(), item.getFilename());
        resolve({ savePath: item.getSavePath(), history: history });
        if (!browserWindow.isDestroyed()) browserWindow.close();
      });
    });

    browserWindow.once('closed', () => {
      resolve(null);
    });
  });
}
