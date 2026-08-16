import { app } from 'electron';
import fs from 'fs-extra';
import path from 'node:path';
import { isParent } from '../../shared/apmPath';
import { getHash } from '../../shared/getHash';

/**
 * Returns whether the temporary file exists and its path.
 * 旧 EXISTS_TEMP_FILE ハンドラのロジックと同一(IPC と main 内部の両方から使う)。
 * @param {string} relativePath - A relative path from the data directory.
 * @param {string} [keyText] - String used to generate the hash prefix.
 * @returns {object} Whether the file exists, and its absolute path.
 */
export function existsTempFile(relativePath: string, keyText?: string) {
  const dataDir = path.join(app.getPath('userData'), 'Data/');
  let filePath = path.join(dataDir, relativePath);
  if (!isParent(dataDir, filePath)) {
    throw new Error(`An invalid path was requested: ${relativePath}`);
  }
  if (keyText) {
    filePath = path.join(
      path.dirname(filePath),
      getHash(keyText) + '_' + path.basename(filePath),
    );
  }
  return { exists: fs.existsSync(filePath), path: filePath };
}
