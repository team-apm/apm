import { ipcRenderer } from 'electron';
import setting from '../setting/setting';
import parseXML from './parseXML';

/**
 * Download mod.xml.
 */
async function downloadData() {
  await ipcRenderer.invoke('download', setting.getModDataUrl(), false, '');
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

const mod = { downloadData, getInfo };
export default mod;
