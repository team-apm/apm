import { remove } from 'fs-extra';
import { isParent } from './apmPath';

/**
 * Deletes the file specified in {path}
 * ログは呼び出し側の責務(shared は electron-log に依存しない)。
 * @param {string} path  -
 * @param {string} parentFolder - The folder containing the file to be deleted.
 */
export async function safeRemove(path: string, parentFolder: string) {
  if (isParent(parentFolder, path)) {
    await remove(path);
  } else {
    throw new Error(`An invalid delete operation was attempted. ${path}`);
  }
}
