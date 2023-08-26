import {
  deleteProperty,
  getProperty,
  hasProperty,
  setProperty,
} from 'dot-prop';
import log from 'electron-log';
import { readJson, writeJson } from 'fs-extra';
import path from 'path';
import { ApmJsonObject } from '../types/apmJson';
import { PackageItem } from '../types/packageItem';

/**
 * Gets the object parsed from `apm.json`.
 * @param {string} instPath - An installation path
 * @returns {object} An object like `package.json`
 */
async function getApmJson(instPath: string): Promise<ApmJsonObject> {
  try {
    const value = await readJson(getPath(instPath));
    if (typeof value === 'object') {
      return value as ApmJsonObject;
    } else {
      throw new Error('Invalid apm.json.');
    }
  } catch (e) {
    if (e.code !== 'ENOENT') log.error(e);
    return { dataVersion: '3', core: {}, packages: {} };
  }
}

/**
 * Sets and save the object to `apm.json`.
 * @param {string} instPath - An installation path
 * @param {object} object - An object to write
 */
async function setApmJson(instPath: string, object: unknown) {
  await writeJson(getPath(instPath), object, { spaces: 2 });
}

// Functions to be exported

/**
 * Returns the path of `apm.json`.
 * @param {string} instPath - An installation path
 * @returns {string} The path of `apm.json`
 */
export function getPath(instPath: string) {
  return path.join(instPath, 'apm.json');
}

/**
 * Checks whether `apm.json` has the property.
 * @param {string} instPath - An installation path
 * @param {string} path - Key to check existing
 * @returns {boolean} Whether `apm.json` has the property.
 */
export async function has(instPath: string, path: string) {
  return hasProperty(await getApmJson(instPath), path);
}

/**
 * Gets the value from `apm.json`.
 * @param {string} instPath - An installation path
 * @param {string} path - Key to get value
 * @param {unknown} [defaultValue] - A value replaced when the property don't exists.
 * @returns {unknown} The property selected by key.
 */
export async function get(instPath: string, path = '', defaultValue?: unknown) {
  return getProperty(await getApmJson(instPath), path, defaultValue);
}

/**
 * Sets the value to `apm.json`.
 * @param {string} instPath - An installation path
 * @param {string} path - Key to set value
 * @param {unknown} [value] - A value to set
 */
export async function set(instPath: string, path: string, value: unknown) {
  const object = setProperty(await getApmJson(instPath), path, value);
  await setApmJson(instPath, object);
}

/**
 * Deletes the value from `apm.json`.
 * @param {string} instPath - An installation path
 * @param {string} path - Key to delete value
 */
async function deleteItem(instPath: string, path: string) {
  const object = await getApmJson(instPath);
  deleteProperty(object, path);
  await setApmJson(instPath, object);
}

export { deleteItem as delete };

/**
 * Sets the core version to `apm.json`.
 * @param {string} instPath - An installation path
 * @param {string} program - A name of the program
 * @param {string} version - A version of the program
 */
export async function setCore(
  instPath: string,
  program: string,
  version: string,
) {
  await set(instPath, `core.${program}`, version);
}

/**
 * Adds the information of the package to `apm.json`.
 * @param {string} instPath - An installation path
 * @param {PackageItem} packageItem - An information of a package
 */
export async function addPackage(instPath: string, packageItem: PackageItem) {
  await set(instPath, `packages.${packageItem.id}`, {
    id: packageItem.id,
    version: packageItem.info.latestVersion,
  });
}

/**
 * Removes the information of the package from `apm.json`.
 * @param {string} instPath - An installation path
 * @param {PackageItem} packageItem - An information of a package
 */
export async function removePackage(
  instPath: string,
  packageItem: PackageItem,
) {
  await deleteItem(instPath, `packages.${packageItem.id}`);
}
