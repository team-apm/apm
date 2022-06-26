import log from 'electron-log';
import { remove } from 'fs-extra';
import { isParent } from './apmPath';

/**
 * Deletes the file specified in {path}
 *
 * @param {string} path  -
 * @param {string} parentFolder - The folder containing the file to be deleted.
 */
export async function safeRemove(path: string, parentFolder: string) {
  if (isParent(parentFolder, path)) {
    await remove(path);
  } else {
    const message = `An invalid delete operation was attempted. ${path}`;
    log.error(message);
    throw new Error(message);
  }
}
