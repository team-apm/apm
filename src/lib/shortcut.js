const path = require('path');
const { shell } = require('electron');
const fs = require('fs');

const getShortcutPath = (appDataPath) =>
  path.join(appDataPath, 'Microsoft/Windows/Start Menu/Programs', 'AviUtl.lnk');

/**
 * Add a shortcut to the Start menu
 *
 * @param {string} appDataPath - The path to AppData
 * @param {string} targetEXE - The path to aviutl.exe
 */
function addAviUtlShortcut(appDataPath, targetEXE) {
  if (process.platform === 'win32') {
    shell.writeShortcutLink(getShortcutPath(appDataPath), {
      target: targetEXE,
    });
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

module.exports = {
  addAviUtlShortcut,
  removeAviUtlShortcut,
  uninstaller,
};
