import {
  deleteProperty,
  getProperty,
  hasProperty,
  setProperty,
} from 'dot-prop';
import log from 'electron-log';
import { readJsonSync, writeJsonSync } from 'fs-extra';
import path from 'path';

/**
 * Returns the path of `apm.json`.
 *
 * @param {string} instPath - An installation path
 * @returns {string} The path of `apm.json`
 */
function getPath(instPath) {
  return path.join(instPath, 'apm.json');
}

/**
 * Gets the object parsed from `apm.json`.
 *
 * @param {string} instPath - An installation path
 * @returns {object} An object like `package.json`
 */
function getApmJson(instPath) {
  try {
    const value = readJsonSync(getPath(instPath));
    if (typeof value === 'object') {
      return value;
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
 *
 * @param {string} instPath - An installation path
 * @param {object} object - An object to write
 */
function setApmJson(instPath, object) {
  writeJsonSync(getPath(instPath), object, { spaces: 2 });
}

// Functions to be exported

/**
 * Checks whether `apm.json` has the property.
 *
 * @param {string} instPath - An installation path
 * @param {string} path - Key to check existing
 * @returns {boolean} Whether `apm.json` has the property.
 */
function has(instPath, path) {
  return hasProperty(getApmJson(instPath), path);
}

/**
 * Gets the value from `apm.json`.
 *
 * @param {string} instPath - An installation path
 * @param {string} path - Key to get value
 * @param {any} [defaultValue] - A value replaced when the property don't exists.
 * @returns {any} The property selected by key.
 */
function get(instPath, path = '', defaultValue) {
  return getProperty(getApmJson(instPath), path, defaultValue);
}

/**
 * Sets the value to `apm.json`.
 *
 * @param {string} instPath - An installation path
 * @param {string} path - Key to set value
 * @param {any} [value] - A value to set
 */
function set(instPath, path, value) {
  const object = setProperty(getApmJson(instPath), path, value);
  setApmJson(instPath, object);
}

/**
 * Deletes the value from `apm.json`.
 *
 * @param {string} instPath - An installation path
 * @param {string} path - Key to delete value
 */
function deleteItem(instPath, path) {
  const object = getApmJson(instPath);
  deleteProperty(object, path);
  setApmJson(instPath, object);
}

/**
 * Sets the core version to `apm.json`.
 *
 * @param {string} instPath - An installation path
 * @param {string} program - A name of the program
 * @param {string} version - A version of the program
 */
function setCore(instPath, program, version) {
  set(instPath, `core.${program}`, version);
}

/**
 * Adds the information of the package to `apm.json`.
 *
 * @param {string} instPath - An installation path
 * @param {object} packageItem - An information of a package
 */
function addPackage(instPath, packageItem) {
  set(instPath, `packages.${packageItem.id}`, {
    id: packageItem.id,
    version: packageItem.info.latestVersion,
  });
}

/**
 * Removes the information of the package from `apm.json`.
 *
 * @param {string} instPath - An installation path
 * @param {object} packageItem - An information of a package
 */
function removePackage(instPath, packageItem) {
  deleteItem(instPath, `packages.${packageItem.id}`);
}

const apmJson = {
  getPath,
  has,
  get,
  set,
  delete: deleteItem,
  setCore,
  addPackage,
  removePackage,
};
export default apmJson;
