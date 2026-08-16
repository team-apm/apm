import fs from 'fs-extra';
import path from 'node:path';
import { resolvePath } from '../shared/resolvePath';
import { getConfig } from './Config';
import { existsTempFile } from './ipcWrapper';
import * as parseJson from './parseJson';
import { trpc } from './trpcClient';

const config = getConfig();

// Functions to be exported

/**
 * Download list.json.
 * 実装は main プロセス側(src/main/services/modList.ts)へ移設済み。
 */
export async function updateInfo() {
  await trpc.modList.updateInfo.mutate();
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
      instPath && instPath.length > 0
        ? [
            getLocalPackagesDataUrl(instPath),
            getEditorPackagesDataUrl(instPath),
          ].filter((p) => fs.existsSync(p))
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
 * Returns a data editor's package data file URL.
 * @param {string} instPath - An installation path.
 * @returns {string} - A package data file URL.
 */
export function getEditorPackagesDataUrl(instPath: string) {
  return path.join(instPath, 'editorPackages.json');
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
