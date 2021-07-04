const path = require('path');
const AdmZip = require('adm-zip');

/**
 * Unzips zip archive.
 *
 * @param {string} zipPath - A path to zip archive.
 * @returns {string} A path to unzipped directory.
 */
module.exports = function (zipPath) {
  const zip = new AdmZip(zipPath);
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
  zip.extractAllTo(targetPath, true);
  return targetPath;
};
