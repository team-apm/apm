import { app, BrowserWindow, type DownloadItem } from 'electron';
import { CancelError, download } from 'electron-dl';
import log from 'electron-log/main';
import fs, { mkdir } from 'fs-extra';
import path from 'node:path';
import { isParent } from '../../shared/apmPath';
import { getHash } from '../../shared/getHash';

// electron-dl の download() は session 共有の will-download リスナーを呼び出しの
// たびに登録し、リスナーは自分宛てでない DownloadItem にも savePath を設定する。
// そのため並行実行すると保存先の取り違えや同一ファイルへの同時書き込み
// (Windows ではロック違反で interrupted)が起きる。呼び出しを直列化して回避する
let downloadChain: Promise<void> = Promise.resolve();

// 受信バイト数がこの時間増えなかったらダウンロードを停滞と見なして中断する(#2399)
const STALL_TIMEOUT_MS = 30_000;

/**
 * Downloads a URL, cancelling the download if no bytes arrive for a while.
 * @param {BrowserWindow} win - The window that receives the download progress.
 * @param {string} url - The URL to download.
 * @param {object} opt - Options passed through to electron-dl.
 * @param {boolean} opt.overwrite - Whether to overwrite an existing file.
 * @param {string} opt.directory - The directory to save the file in.
 * @param {string} opt.filename - Name of the saved file.
 * @returns {Promise<void>} Resolves when the download completes.
 */
async function downloadWithStallGuard(
  win: BrowserWindow,
  url: string,
  opt: { overwrite: boolean; directory: string; filename: string },
) {
  // 「開始から N 秒」の全体タイムアウトにはしない。遅い回線で大きなアーカイブを
  // 落とすケースを打ち切ってしまうため、進んでいる限り待ち続け、止まったら切る。
  // なお DownloadItem は onStarted(サーバー応答後)でしか取得できないため、
  // 応答ヘッダが一度も届かないタイプの停滞はここでは中断できない
  let item: DownloadItem | undefined;
  let stalled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let receivedBytes = -1;
  const resetTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      stalled = true;
      item?.cancel();
    }, STALL_TIMEOUT_MS);
  };
  try {
    await download(win, url, {
      ...opt,
      onStarted: (i) => {
        item = i;
        resetTimer();
      },
      onProgress: (progress) => {
        if (progress.transferredBytes > receivedBytes) {
          receivedBytes = progress.transferredBytes;
          resetTimer();
        }
      },
    });
  } catch (e) {
    // 停滞起因の CancelError はログから原因が分かるエラーに変換する
    if (stalled && e instanceof CancelError) {
      throw new Error(`Download stalled for ${STALL_TIMEOUT_MS}ms: ${url}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Downloads a file (or copies a local file) into the data folder.
 * @param {BrowserWindow} win - The window that receives the download progress.
 * @param {string} url - The URL (or a local file path) to download.
 * @param {object} [options] - Options.
 * @param {boolean} [options.loadCache] - Whether to return the cached file if it exists.
 * @param {string} [options.subDir] - The subdirectory in the data folder to save the file.
 * @param {string} [options.keyText] - A text whose hash is prepended to the file name.
 * @returns {Promise<string | undefined>} The path of the downloaded file, or undefined on failure.
 */
export async function downloadFile(
  win: BrowserWindow,
  url: string,
  {
    loadCache = false,
    subDir = '',
    keyText,
  }: { loadCache?: boolean; subDir?: string; keyText?: string } = {},
) {
  const dataDir = path.join(app.getPath('userData'), 'Data/');
  const opt = {
    overwrite: true,
    directory: path.join(
      dataDir,
      subDir,
      ['.zip', '.lzh', '.7z', '.rar'].includes(path.extname(url))
        ? 'archive'
        : '',
    ),
    filename: (keyText ? getHash(keyText) + '_' : '') + path.basename(url),
  };
  const retFilePath = path.join(opt.directory, opt.filename);
  // subDir 経由でデータフォルダ外に書き込ませない
  if (!isParent(dataDir, retFilePath)) {
    log.error(`Refused to download outside the data folder: ${subDir}`);
    return undefined;
  }
  // 現状ファイル名を decode する箇所は無いが、将来どこかで decode されると
  // パス区切りに化ける値(%2f・%5c)は入口で拒否しておく
  if (/%2f|%5c/i.test(opt.filename)) {
    log.error(`Refused an encoded path separator in the file name: ${url}`);
    return undefined;
  }
  if (loadCache && fs.existsSync(retFilePath)) return retFilePath;

  try {
    if (url.startsWith('http')) {
      const run = downloadChain.then(() =>
        downloadWithStallGuard(win, url, opt),
      );
      downloadChain = run.then(
        (): void => undefined,
        (): void => undefined,
      );
      await run;
    } else {
      await mkdir(path.dirname(retFilePath), { recursive: true });
      fs.copyFileSync(url, retFilePath);
    }
    return retFilePath;
  } catch (e) {
    log.error(e);
    return undefined;
  }
}
