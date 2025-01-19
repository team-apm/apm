import log from 'electron-log';
import fs, { copy, existsSync } from 'fs-extra';
import path from 'path';
import { safeRemove } from '../../lib/safeRemove';

export const programs = ['aviutl', 'exedit'] as const;
export const programsDisp = { aviutl: 'AviUtl', exedit: '拡張編集' };

type Files = {
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
      if (fs.existsSync(path.join(instPath, file.filename))) {
        existCount++;
      }
    }
  }
  return filesCount === existCount;
}

/**
 * Install some package.
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
  try {
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
          file.archivePath
            ? path.join(
                unzippedPath,
                file.archivePath,
                path.basename(file.filename),
              )
            : path.join(unzippedPath, path.basename(file.filename)),
          path.join(instPath, file.filename),
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
  } catch (e) {
    log.error(e);
    throw new Error('An error has occurred.');
  }
}
