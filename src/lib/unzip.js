const path = require('path');
const sevenBin = require('7zip-bin');
const { extractFull } = require('node-7z');

const pathTo7zip = sevenBin.path7za.replace('app.asar', 'app.asar.unpacked');

/**
 * Unzips zip archive.
 *
 * @param {string} zipPath - A path to zip archive.
 * @param {string} encode - An encode of zip archive.
 * @returns {Promise<string>} A path to unzipped directory.
 */
module.exports = async function (zipPath, encode = 'utf8') {
  const getTargetPath = () => {
    if (path.resolve(path.dirname(zipPath), '../../').endsWith('Data')) {
      return path.resolve(
        path.dirname(zipPath),
        '../',
        path.basename(zipPath, '.zip')
      );
    } else {
      return path.resolve(
        path.dirname(zipPath),
        path.basename(zipPath, '.zip')
      );
    }
  };
  const targetPath = getTargetPath();
  const zipStream = extractFull(zipPath, targetPath, {
    $bin: pathTo7zip,
    overwrite: 'a',
  });
  return new Promise((resolve) => {
    zipStream.once('end', () => {
      resolve(targetPath);
    });
  });
};
