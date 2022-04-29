import { ipcRenderer } from 'electron';
import fs from 'fs-extra';
import Store from 'electron-store';
import path from 'path';
const store = new Store();
import parseJson from './parseJson';

/**
 * Download mod.json.
 */
async function downloadData() {
  await ipcRenderer.invoke('download', getModDataUrl(), false, '');
}

/**
 * Returns an object parsed from mod.json.
 *
 * @returns {Promise<object>} - An object parsed from core.json.
 */
async function getInfo() {
  const modFile = await ipcRenderer.invoke('exists-temp-file', 'list.json');
  if (modFile.exists) {
    try {
      return await parseJson.getMod(modFile.path);
    } catch {
      return null;
    }
  } else {
    return null;
  }
}

/**
 * Returns a data files URL.
 *
 * @returns {string} - A data files URL.
 */
function getDataUrl() {
  return store.get('dataURL.main') as string;
}

/**
 * Returns extra data files URLs.
 *
 * @returns {string} - Data files URLs.
 */
function getExtraDataUrl() {
  return store.get('dataURL.extra') as string;
}

/**
 * Returns a core data file URL.
 *
 * @returns {string} - A core data file URL.
 */
function getCoreDataUrl() {
  const dataUrl = getDataUrl();
  return path.join(dataUrl, 'core.json');
}

/**
 * Returns package data files URLs.
 *
 * @param {string} instPath - An installation path.
 * @returns {Array.<string>} -Package data files URLs.
 */
function getPackagesDataUrl(instPath: string) {
  return (store.get('dataURL.packages') as string[]).concat(
    instPath &&
      instPath.length > 0 &&
      fs.existsSync(getLocalPackagesDataUrl(instPath))
      ? [getLocalPackagesDataUrl(instPath)]
      : []
  );
}

/**
 * Returns local package data files URL.
 *
 * @param {string} instPath - An installation path.
 * @returns {string} - Package data files URL.
 */
function getLocalPackagesDataUrl(instPath: string) {
  return path.join(instPath, 'packages.json');
}

/**
 * Returns a mod data file URL.
 *
 * @returns {string} - A mod data file URL.
 */
function getModDataUrl() {
  const dataUrl = getDataUrl();
  return path.join(dataUrl, 'list.json');
}

const mod = {
  downloadData,
  getInfo,
  getDataUrl,
  getExtraDataUrl,
  getCoreDataUrl,
  getPackagesDataUrl,
  getLocalPackagesDataUrl,
  getModDataUrl,
};
export default mod;
