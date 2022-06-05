import { path7za } from '7zip-bin';
import { extractFull } from 'node-7z';
import path from 'path';
import win7zip from 'win-7zip';
const isDevEnv = process.env.NODE_ENV === 'development';

// https://github.com/puppeteer/puppeteer/issues/2134#issuecomment-408221446
const pathTo7zipCross = isDevEnv
  ? path7za
  : path7za.replace('app.asar', 'app.asar.unpacked');
const pathTo7zipWin = isDevEnv
  ? win7zip['7z']
  : win7zip['7z'].replace('app.asar', 'app.asar.unpacked');

/**
 * Unzips zip archive.
 *
 * @param {string} zipPath - A path to zip archive.
 * @param {string} [folderName] - Name of the extracted folder.
 * @returns {Promise<string>} A path to unzipped directory.
 */
async function unzip(zipPath, folderName) {
  const getTargetPath = () => {
    if (path.resolve(path.dirname(zipPath), '../../').endsWith('Data')) {
      return path.resolve(
        path.dirname(zipPath),
        '../',
        folderName ?? path.basename(zipPath, path.extname(zipPath))
      );
    } else {
      return path.resolve(
        path.dirname(zipPath),
        folderName ?? path.basename(zipPath, path.extname(zipPath))
      );
    }
  };
  const targetPath = getTargetPath();
  const zipStream = extractFull(zipPath, targetPath, {
    $bin: process.platform === 'win32' ? pathTo7zipWin : pathTo7zipCross,
    overwrite: 'a',
  });
  return new Promise((resolve) => {
    zipStream.once('end', () => {
      resolve(targetPath);
    });
  });
}

export default unzip;
