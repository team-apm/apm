const { ipcRenderer } = require('electron');
const setting = require('../setting/setting');
const parseXML = require('./parseXML');

/**
 *
 */
async function downloadData() {
  await ipcRenderer.invoke('download', setting.getModDataUrl(), true, '');
}

/**
 * Returns an object parsed from mod.xml.
 *
 * @returns {Promise<object>} - An object parsed from core.xml.
 */
async function getInfo() {
  const modFile = await ipcRenderer.invoke('exists-temp-file', 'mod.xml');
  if (modFile.exists) {
    try {
      return parseXML.getMod(modFile.path);
    } catch {
      return null;
    }
  } else {
    return false;
  }
}

module.exports = { downloadData, getInfo };
