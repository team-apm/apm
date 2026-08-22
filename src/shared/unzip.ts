import { path7za } from '7zip-bin';
import { readdir, remove } from 'fs-extra';
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

// 7za の実行ビットが落ちていて spawn が EACCES になることがある
// (macOS / Linux のみ)。パッケージ版で asar からコピーされるときだけでなく、
// yarn がキャッシュから node_modules へ展開する時点で落ちている例もあるため、
// dev でも起こりうる。spawn 前に付与する
if (process.platform !== 'win32') {
  try {
    chmodSync(pathTo7zip, 0o755);
  } catch {
    // 失敗しても spawn 時に EACCES / ENOENT として顕在化するため何もしない
  }
}

/**
 * Removes symlinks under the extracted folder.
 * アーカイブ由来の symlink が残ると、後続のコピーや探索が展開ディレクトリの
 * 外を参照し得る。同梱の 7za は現状 symlink を復元しないが、バイナリ更新や
 * アーカイブ形式で挙動が変わっても効くよう、展開後の一掃として防御する。
 * @param {string} dir - The folder to scan recursively.
 */
export async function removeSymlinks(dir: string) {
  for (const dirent of await readdir(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, dirent.name);
    if (dirent.isSymbolicLink()) {
      await remove(entryPath);
    } else if (dirent.isDirectory()) {
      await removeSymlinks(entryPath);
    }
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
      removeSymlinks(targetPath).then(() => resolve(targetPath), reject);
    });
    zipStream.once('error', (err: Error) => {
      reject(
        new Error(`Failed to unzip ${zipPath}: ${err.message}`, { cause: err }),
      );
    });
  });
}

export default unzip;
