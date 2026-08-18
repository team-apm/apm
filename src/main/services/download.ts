import { app, BrowserWindow } from 'electron';
import { download } from 'electron-dl';
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
  if (loadCache && fs.existsSync(retFilePath)) return retFilePath;

  try {
    if (url.startsWith('http')) {
      const run = downloadChain.then(() => download(win, url, opt));
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
