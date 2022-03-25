import path from 'path';
import { shell } from 'electron';
import fs from 'fs';

const getShortcutPath = (appDataPath) =>
  path.join(appDataPath, 'Microsoft/Windows/Start Menu/Programs', 'AviUtl.lnk');

/**
 * Add a shortcut to the Start menu
 *
 * @param {string} appDataPath - The path to AppData
 * @param {string} apmPath - The path to apm.exe
 * @param {string} targetEXE - The path to aviutl.exe
 */
function addAviUtlShortcut(appDataPath, apmPath, targetEXE) {
  if (process.platform === 'win32') {
    // appDataPath: %AppData%\Roaming
    // dirname(appDataPath): %AppData%
    // apmPath (if installed): %AppData%\Local\**\*.*

    if (apmPath.includes(path.dirname(appDataPath))) {
      // Verify that it is the installed version of apm

      shell.writeShortcutLink(getShortcutPath(appDataPath), {
        target: targetEXE,
      });
    } else {
      // Removal of shortcuts introduced by previous versions of apm
      removeAviUtlShortcut(appDataPath);
    }
  }
}

/**
 * Remove the shortcut from the Start menu
 *
 * @param {string} appDataPath - The path to AppData
 */
function removeAviUtlShortcut(appDataPath) {
  if (
    process.platform === 'win32' &&
    fs.existsSync(getShortcutPath(appDataPath))
  ) {
    fs.unlinkSync(getShortcutPath(appDataPath));
  }
}

/**
 * Uninstaller for shortcuts. This function MUST be executed before the squirrelCommand is interpreted.
 *
 * @param {string} appDataPath - The path to AppData
 */
function uninstaller(appDataPath) {
  if (process.platform === 'win32') {
    const squirrelCommand = process.argv[1];
    if (squirrelCommand === '--squirrel-uninstall')
      removeAviUtlShortcut(appDataPath);
  }
}

const shortcut = {
  addAviUtlShortcut,
  removeAviUtlShortcut,
  uninstaller,
};
export default shortcut;
