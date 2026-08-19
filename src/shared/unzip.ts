import { path7za } from '7zip-bin';
import { extractFull } from 'node-7z';
import { chmodSync } from 'node:fs';
import path from 'node:path';
import win7zip from 'win-7zip';

const isDevEnv = process.env.NODE_ENV === 'development';

let pathTo7zip = process.platform === 'win32' ? win7zip['7z'] : path7za;

// https://github.com/puppeteer/puppeteer/issues/2134#issuecomment-408221446
if (!isDevEnv) {
  pathTo7zip = pathTo7zip.replace('app.asar', 'app.asar.unpacked');
}

// パッケージ版では asset relocator が native_modules へコピーした 7za の
// 実行ビットが落ちていて spawn が EACCES になる(macOS / Linux のみ。
// dev の node_modules 直下は実行可能なので無症状)。spawn 前に付与する
if (process.platform !== 'win32') {
  try {
    chmodSync(pathTo7zip, 0o755);
  } catch {
    // 失敗しても spawn 時に EACCES / ENOENT として顕在化するため何もしない
  }
}

/**
 * Unzips zip archive.
 * @param {string} zipPath - A path to zip archive.
 * @param {string} [folderName] - Name of the extracted folder.
 * @returns {Promise<string>} A path to unzipped directory.
 */
async function unzip(zipPath: string, folderName?: string) {
  const getTargetPath = () => {
    if (path.resolve(path.dirname(zipPath), '../../').endsWith('Data')) {
      return path.resolve(
        path.dirname(zipPath),
        '../',
        folderName ?? path.basename(zipPath, path.extname(zipPath)),
      );
    } else {
      return path.resolve(
        path.dirname(zipPath),
        folderName ?? path.basename(zipPath, path.extname(zipPath)),
      );
    }
  };
  const targetPath = getTargetPath();
  const zipStream = extractFull(zipPath, targetPath, {
    $bin: pathTo7zip,
    overwrite: 'a',
    ...(path.extname(zipPath) === '.7z'
      ? {}
      : {
          method: ['cp=932'],
        }),
    // AviUtl script is encoded in Shift_JIS, so we need to specify the code page as Shift_JIS(932) when unzipping.
    // But you must not specify when unzipping .7z.
  });
  return new Promise<string>((resolve, reject) => {
    zipStream.once('end', () => {
      resolve(targetPath);
    });
    zipStream.once('error', (err: Error) => {
      reject(
        new Error(`Failed to unzip ${zipPath}: ${err.message}`, { cause: err }),
      );
    });
  });
}

export default unzip;
