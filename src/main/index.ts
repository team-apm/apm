import { app, BrowserWindow, dialog, MessageBoxSyncOptions } from 'electron';
import debug from 'electron-debug';
import log from 'electron-log/main';
import Store from 'electron-store';
import 'source-map-support/register';
import { getConfig } from '../lib/Config';
import { registerIpcHandlers } from './ipcHandlers';
import { ensureAutoUpdateDefault } from './services/appUpdate';
import * as shortcut from './shortcut';
import { launch } from './windows';

log.initialize();

log.errorHandler.startCatching({
  showDialog: false,
  onError: () => {
    const options: MessageBoxSyncOptions = {
      title: 'エラー',
      message: `予期しないエラーが発生したため、AviUtl Package Managerを終了します。\nログファイル: ${
        log.transports.file.getFile().path
      }`,
      type: 'error',
    };
    if (app.isReady()) {
      dialog.showMessageBoxSync(options);
    } else {
      dialog.showErrorBox(options.title, options.message);
    }

    app.quit();
  },
});

shortcut.uninstaller(app.getPath('appData'));
if (require('electron-squirrel-startup')) app.quit();
log.debug(process.versions);

const isDevEnv = process.env.NODE_ENV === 'development';
if (isDevEnv) app.setPath('userData', app.getPath('userData') + '_Dev');
debug({ showDevTools: false }); // Press F12 to open DevTools

Store.initRenderer();
const config = getConfig();

ensureAutoUpdateDefault(config);

registerIpcHandlers();

const allowedHosts: string[] = [];

app.on(
  'certificate-error',
  async (event, webContents, url, error, certificate, callback) => {
    if (error === 'net::ERR_SSL_OBSOLETE_VERSION') {
      event.preventDefault();
      const host = new URL(url).hostname;
      if (allowedHosts.includes(host)) {
        callback(true);
      } else {
        const win = BrowserWindow.getFocusedWindow();
        const response = await dialog.showMessageBox(win, {
          title: '安全ではない接続',
          message: `このサイトでは古いセキュリティ設定を使用しています。このサイトに情報を送信すると流出する恐れがあります。`,
          detail: error,
          type: 'warning',
          buttons: ['戻る', `${host}にアクセスする（安全ではありません）`],
          cancelId: 0,
        });
        if (response.response === 1) {
          allowedHosts.push(host);
          callback(true);
        } else {
          callback(false);
        }
      }
    }
  },
);

void app.whenReady().then(async () => {
  await launch(config);

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await launch(config);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
