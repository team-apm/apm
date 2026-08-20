import { app, BrowserWindow, type DownloadItem, type Event } from 'electron';
import path from 'node:path';
import { resolveInside } from '../../shared/apmPath';

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
    // 任意の外部サイトを表示する窓なので、main 窓の既定セッション
    // (Cookie・ストレージ)を共有させない。persist: を付けないのは、
    // 閲覧状態をアプリ終了後まで持ち越す理由が無いため
    webPreferences: { sandbox: true, partition: 'browser' },
    parent,
    modal: true,
    icon: icon,
  });

  const ses = browserWindow.webContents.session;
  // ダウンロードに権限(通知・カメラ等)は不要なので一律拒否する
  ses.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  );
  // 新窓は作らせない。ポップアップで DL ページを開くサイトのために
  // http(s) は同じ窓内で開く
  browserWindow.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
    if (/^https?:\/\//.test(popupUrl))
      void browserWindow.webContents.loadURL(popupUrl);
    return { action: 'deny' };
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

    const onWillDownload = (event: Event, item: DownloadItem) => {
      if (!browserWindow.isDestroyed()) browserWindow.hide();

      // getFilename() はサイト側が決める名前なので、パス区切りを含んでも
      // データフォルダの外へ出ないよう basename + resolveInside を通す
      const filename = path.basename(item.getFilename());
      const ext = path.extname(filename);
      const dir = path.join(app.getPath('userData'), 'Data');
      const subDirs = ['.zip', '.lzh', '.7z', '.rar'].includes(ext)
        ? [type, 'archive']
        : [type];
      item.setSavePath(resolveInside(dir, ...subDirs, filename));

      item.once('done', () => {
        history.push(...item.getURLChain(), item.getFilename());
        resolve({ savePath: item.getSavePath(), history: history });
        if (!browserWindow.isDestroyed()) browserWindow.close();
      });
    };
    ses.once('will-download', onWillDownload);

    browserWindow.once('closed', () => {
      // partition は openBrowser 呼び出し間で共有される。DL せずに閉じた
      // とき once リスナーが残留して次回の DL を横取りしないよう外す
      ses.removeListener('will-download', onWillDownload);
      resolve(null);
    });
  });
}
