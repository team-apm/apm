import { copy, existsSync } from 'fs-extra';
import path from 'node:path';
import { resolveInside } from './apmPath';
import { safeRemove } from './safeRemove';

export type Files = {
  filename: string;
  isUninstallOnly?: boolean;
  isObsolete?: boolean;
  archivePath?: string;
}[];

/**
 * Verifys files by count.
 * @param {string} instPath - An installation path.
 * @param {object[]} files - An array of the files to be installed.
 * @returns {boolean} Whether all files exist.
 */
export function verifyFilesByCount(instPath: string, files: Files) {
  let filesCount = 0;
  let existCount = 0;
  for (const file of files) {
    if (!file.isUninstallOnly && !file.isObsolete) {
      filesCount++;
      if (existsSync(path.join(instPath, file.filename))) {
        existCount++;
      }
    }
  }
  return filesCount === existCount;
}

/**
 * Install some package.
 * エラーは発生元の例外をそのまま投げる(ログは呼び出し側の責務)。
 * @param {string} unzippedPath - A path of the unzipped directory.
 * @param {string} instPath - An installation path.
 * @param {object[]} files - An array of the files to be installed.
 * @param {boolean} isProgram - Whether it is a program.
 * @returns {Promise<boolean>} Whether the installation was successful.
 */
export async function install(
  unzippedPath: string,
  instPath: string,
  files: Files,
  isProgram = false,
) {
  if (isProgram) {
    await copy(unzippedPath, instPath);
  } else {
    // Delete obsolete files
    for (const file of files) {
      if (file.isObsolete && existsSync(path.join(instPath, file.filename))) {
        await safeRemove(path.join(instPath, file.filename), instPath);
      }
    }

    // Copying files (main body of the installation)
    const filesToCopy = [];
    const filesToInstall = files.filter((file) => !file.isObsolete);
    for (const file of filesToInstall) {
      const filePath = [
        // archivePath もリモート由来。展開ディレクトリの外(任意のローカル
        // ファイル)をコピー元にされないよう、書き込み先と同じ関門を通す
        file.archivePath
          ? resolveInside(
              unzippedPath,
              file.archivePath,
              path.basename(file.filename),
            )
          : path.join(unzippedPath, path.basename(file.filename)),
        // filename はリモート由来。削除側(safeRemove)と同じくインストール先の
        // 外を指していないか確かめてから書き込む
        resolveInside(instPath, file.filename),
      ];
      if (file.isUninstallOnly) {
        if (existsSync(filePath[0]) && !existsSync(filePath[1]))
          filesToCopy.push(filePath);
      } else filesToCopy.push(filePath);
    }

    await Promise.all(
      filesToCopy.map((filePath) => copy(filePath[0], filePath[1])),
    );
  }

  if (verifyFilesByCount(instPath, files)) {
    return true;
  } else {
    throw new Error('Could not verify that the files was installed.');
  }
}
