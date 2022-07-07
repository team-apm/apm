import { shell } from 'electron';
import fs from 'fs';
import path from 'path';

const getShortcutPath = (appDataPath: string) =>
  path.join(appDataPath, 'Microsoft/Windows/Start Menu/Programs', 'AviUtl.lnk');

/**
 * Add a shortcut to the Start menu
 *
 * @param {string} appDataPath - The path to AppData
 * @param {string} targetEXE - The path to aviutl.exe
 */
export function addAviUtlShortcut(appDataPath: string, targetEXE: string) {
  if (process.platform === 'win32') {
    shell.writeShortcutLink(getShortcutPath(appDataPath), {
      target: targetEXE,
      cwd: path.dirname(targetEXE),
    });
  }
}

/**
 * Remove the shortcut from the Start menu
 *
 * @param {string} appDataPath - The path to AppData
 */
export function removeAviUtlShortcut(appDataPath: string) {
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
export function uninstaller(appDataPath: string) {
  if (process.platform === 'win32') {
    const squirrelCommand = process.argv[1];
    if (squirrelCommand === '--squirrel-uninstall')
      removeAviUtlShortcut(appDataPath);
  }
}
