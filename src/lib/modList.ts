import { ipcRenderer } from 'electron';
import fs from 'fs-extra';
import Store from 'electron-store';
import path from 'path';
const store = new Store();
import parseJson from './parseJson';

/**
 * Resolve paths.
 *
 * @param {string} base - base path
 * @param {string} relative - relative path
 * @returns {string} - absolute path
 */
function resolvePath(base: string, relative: string) {
  if (base.startsWith('http')) {
    return new URL(relative, base).href;
  } else {
    return path.resolve(base, relative);
  }
}

// Functions to be exported

/**
 * Download list.json.
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
 * Returns an object parsed from list.json.
 *
 * @returns {Promise<object>} - An object parsed from list.json.
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
 * Sets package data files URLs.
 *
 * @param {string[]} URLs - URLs for additionally specified packages.
 */
async function setPackagesDataUrl(URLs: string[]) {
  const packages = ([] as string[]).concat(
    (await getInfo()).packages.map((packageItem) =>
      resolvePath(getDataUrl(), packageItem.path)
    ),
    URLs
  );
  store.set('dataURL.packages', packages);
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
async function getCoreDataUrl() {
  return resolvePath(getDataUrl(), (await getInfo()).core.path);
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
async function getConvertDataUrl() {
  return resolvePath(getDataUrl(), (await getInfo()).convert.path);
}

/**
 * Returns a scripts data file URL.
 *
 * @returns {string[]} - A scripts data file URL.
 */
async function getScriptsDataUrl() {
  return (await getInfo()).scripts.map((script) =>
    resolvePath(getDataUrl(), script.path)
  );
}

const mod = {
  downloadData,
  getInfo,
  getDataUrl,
  getExtraDataUrl,
  getCoreDataUrl,
  setPackagesDataUrl,
  getPackagesDataUrl,
  getLocalPackagesDataUrl,
  getConvertDataUrl,
  getScriptsDataUrl,
};
export default mod;
