import { app } from 'electron';
import fs from 'fs-extra';
import path from 'node:path';
import { getHash } from '../../lib/getHash';

/**
 * Get the validated file path.
 * @param {string} relativePath - The relative path to the file.
 * @param {string} keyText - The key text to hash.
 * @returns {object} The object containing the existence and the path of the file.
 */
function getValidatedFilePath(relativePath: string, keyText: string) {
  let filePath = path.join(app.getPath('userData'), 'Data/', relativePath);
  if (keyText) {
    filePath = path.join(
      path.dirname(filePath),
      getHash(keyText) + '_' + path.basename(filePath),
    );
  }
  return { exists: fs.existsSync(filePath), path: filePath };
}

export default getValidatedFilePath;
