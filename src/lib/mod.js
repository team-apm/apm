const { ipcRenderer } = require('electron');
const setting = require('../setting/setting');
const parseXML = require('./parseXML');

module.exports = {
  downloadData: async function () {
    await ipcRenderer.invoke('download', setting.getModDataUrl(), true, '');
  },

  /**
   * Returns an object parsed from mod.xml.
   *
   * @returns {Promise<object>} - An object parsed from core.xml.
   */
  getInfo: async function () {
    const modFile = await ipcRenderer.invoke('exists-temp-file', 'mod.xml');
    if (modFile.exists) {
      try {
        return parseXML.mod(modFile.path);
      } catch {
        return null;
      }
    } else {
      return false;
    }
  },
};
