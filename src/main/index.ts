import { app, BrowserWindow, dialog, MessageBoxOptions } from 'electron';
import debug from 'electron-debug';
import log from 'electron-log/main';
import Store from 'electron-store';
import path from 'node:path';
import 'source-map-support/register';
import { getConfig } from './Config';
import { registerIpcHandlers } from './ipcHandlers';
import { ensureAutoUpdateDefault } from './services/appUpdate';
import * as shortcut from './shortcut';
import { launch } from './windows';

// preload: true(既定)のセッション preload 注入は使わない。注入パスの解決が
// forge の asset relocator に書き換えられ、dev ビルドでは相対パスに壊れて
// Electron 39 の registerPreloadScript が絶対パス検証の警告を出すため。
// 代わりに electron-log 公式のバンドラ向けパターンで、各 preload バンドルが
// 'electron-log/preload' を import して __electronLog を生やす
log.initialize({ preload: false });

log.errorHandler.startCatching({
  showDialog: false,
  // showMessageBoxSync は main のイベントループごと止めるため使わない。
  // ヘッドレス環境(CI の E2E 等)では誰も応答できず quit にも到達しない
  // ハードハングになる(#2401)。electron-log は onError の戻り値(Promise)を
  // 待たずにログを書くので、ダイアログ応答後の quit でもログは失われない
  onError: async () => {
    const options: MessageBoxOptions = {
      title: 'エラー',
      message: `予期しないエラーが発生したため、AviUtl Package Managerを終了します。\nログファイル: ${
        log.transports.file.getFile().path
      }`,
      type: 'error',
    };
    if (app.isReady()) {
      await dialog.showMessageBox(options);
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
// Chromium は --user-data-dir を userData に反映しないため自前で解釈する
// (VS Code 等と同じ方式)。E2E が実プロファイルから隔離して起動するために使う
const userDataDir = app.commandLine.getSwitchValue('user-data-dir');
if (userDataDir) {
  app.setPath('userData', path.resolve(userDataDir));
} else if (isDevEnv) {
  app.setPath('userData', app.getPath('userData') + '_Dev');
}
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
