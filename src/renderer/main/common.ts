import log from 'electron-log/renderer';
import {
  type Files,
  install as installFiles,
  verifyFilesByCount,
} from '../../shared/install';

export const programs = ['aviutl', 'exedit'] as const;
export const programsDisp = { aviutl: 'AviUtl', exedit: '拡張編集' };

export { verifyFilesByCount };

/**
 * Install some package.
 * 実体は src/shared/install.ts(ログとエラーの丸め込みだけここで行う)。
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
    return await installFiles(unzippedPath, instPath, files, isProgram);
  } catch (e) {
    log.error(e);
    throw new Error('An error has occurred.');
  }
}
