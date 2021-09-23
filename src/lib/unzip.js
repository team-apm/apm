const path = require('path');
const sevenBin = require('7zip-bin');
const { extractFull } = require('node-7z');

// https://github.com/puppeteer/puppeteer/issues/2134#issuecomment-408221446
const pathTo7zipCross = sevenBin.path7za.replace(
  'app.asar',
  'app.asar.unpacked'
);
const pathTo7zipWin = require('win-7zip')['7z'].replace(
  'app.asar',
  'app.asar.unpacked'
);

/**
 * Unzips zip archive.
 *
 * @param {string} zipPath - A path to zip archive.
 * @param {string} folderName - Name of the extracted folder.
 * @returns {Promise<string>} A path to unzipped directory.
 */
async function unzip(zipPath, folderName) {
  const getTargetPath = () => {
    if (path.resolve(path.dirname(zipPath), '../../').endsWith('Data')) {
      return path.resolve(
        path.dirname(zipPath),
        '../',
        folderName ? folderName : path.basename(zipPath, path.extname(zipPath))
      );
    } else {
      return path.resolve(
        path.dirname(zipPath),
        folderName ? folderName : path.basename(zipPath, path.extname(zipPath))
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

module.exports = unzip;
