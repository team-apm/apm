import fs from 'fs-extra';
import * as os from 'node:os';
import path from 'node:path';
import Config from './Config';
import { download, existsTempFile } from './ipcWrapper';
import * as parseJson from './parseJson';
import { resolvePath } from './resolvePath';
const config = new Config();

/**
 * Sets package data files URLs.
 */
async function setPackagesDataUrl() {
  const URLs = config.dataURL
    .getExtra()
    .split(os.EOL)
    .filter((url) => url !== '');
  const packages = ([] as string[]).concat(
    (await getInfo()).packages.map((packageItem) =>
      resolvePath(getDataUrl(), packageItem.path),
    ),
    URLs,
  );
  config.dataURL.setPackages(packages);
}

// Functions to be exported

/**
 * Download list.json.
 */
export async function updateInfo() {
  await download(path.join(getDataUrl(), 'list.json'));
  await setPackagesDataUrl();
}

/**
 * Returns an object parsed from list.json.
 * @returns {Promise<object>} - An object parsed from list.json.
 */
export async function getInfo() {
  const modFile = await existsTempFile('list.json');
  if (modFile.exists) {
    return await parseJson.getMod(modFile.path).catch((): null => null);
  } else {
    await updateInfo();
    const downloadedModFile = await existsTempFile('list.json');
    return await parseJson
      .getMod(downloadedModFile.path)
      .catch((): null => null);
  }
}

/**
 * Returns a data files URL.
 * @returns {string} - A data files URL.
 */
export function getDataUrl() {
  return config.dataURL.getMain();
}

/**
 * Returns extra data files URLs.
 * @returns {string} - Data files URLs.
 */
export function getExtraDataUrl() {
  return config.dataURL.getExtra();
}

/**
 * Returns a core data file URL.
 * @returns {string} - A core data file URL.
 */
export async function getCoreDataUrl() {
  return resolvePath(getDataUrl(), (await getInfo()).core.path);
}

/**
 * Returns package data files URLs.
 * @param {string} instPath - An installation path.
 * @returns {Array.<string>} -Package data files URLs.
 */
export function getPackagesDataUrl(instPath: string) {
  return config.dataURL
    .getPackages()
    .concat(
      instPath &&
        instPath.length > 0 &&
        fs.existsSync(getLocalPackagesDataUrl(instPath))
        ? [getLocalPackagesDataUrl(instPath)]
        : [],
    );
}

/**
 * Returns a local package data file URL.
 * @param {string} instPath - An installation path.
 * @returns {string} - A package data file URL.
 */
export function getLocalPackagesDataUrl(instPath: string) {
  return path.join(instPath, 'packages.json');
}

/**
 * Returns a convert data file URL.
 * @returns {string} - A convert data file URL.
 */
export async function getConvertDataUrl() {
  return resolvePath(getDataUrl(), (await getInfo()).convert.path);
}

/**
 * Returns a scripts data file URL.
 * @returns {string[]} - A scripts data file URL.
 */
export async function getScriptsDataUrl() {
  return (await getInfo()).scripts.map((script) =>
    resolvePath(getDataUrl(), script.path),
  );
}
