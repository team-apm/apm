import { ipcRenderer } from 'electron';
import fs from 'fs-extra';
import Store from 'electron-store';
import path from 'path';
const store = new Store();
import parseJson from './parseJson';

// Functions to be exported

/**
 * Download mod.json.
 */
async function downloadData() {
  await ipcRenderer.invoke(
    'download',
    path.join(getDataUrl(), 'list.json'),
    false,
    ''
  );
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
  return path.join(getDataUrl(), 'core.json');
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
 * Returns a local package data file URL.
 *
 * @param {string} instPath - An installation path.
 * @returns {string} - A package data file URL.
 */
function getLocalPackagesDataUrl(instPath: string) {
  return path.join(instPath, 'packages.json');
}

/**
 * Returns a convert data file URL.
 *
 * @returns {string} - A convert data file URL.
 */
function getConvertDataUrl() {
  return path.join(getDataUrl(), 'convert.json');
}

/**
 * Returns a scripts data file URL.
 *
 * @returns {string} - A scripts data file URL.
 */
function getScriptsDataUrl() {
  return path.join(getDataUrl(), 'scripts.json');
}

const mod = {
  downloadData,
  getInfo,
  getDataUrl,
  getExtraDataUrl,
  getCoreDataUrl,
  getPackagesDataUrl,
  getLocalPackagesDataUrl,
  getConvertDataUrl,
  getScriptsDataUrl,
};
export default mod;
