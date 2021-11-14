const fs = require('fs-extra');
const path = require('path');

/**
 * Gets the object parsed from `apm.json`.
 *
 * @param {string} instPath - An installation path
 * @returns {object} An object like `package.json`
 */
function getApmJson(instPath) {
  try {
    const value = fs.readJsonSync(path.join(instPath, 'apm.json'));
    if (typeof value === 'object') {
      return value;
    } else {
      throw new Error('Invalid apm.json.');
    }
  } catch {
    return { core: {}, packages: {} };
  }
}

/**
 * Sets and save the object to `apm.json`.
 *
 * @param {string} instPath - An installation path
 * @param {object} object - An object to write
 */
function setApmJson(instPath, object) {
  fs.writeJsonSync(path.join(instPath, 'apm.json'), object, { spaces: 2 });
}

// Functions to be exported

/**
 * Checks whether `apm.json` has the property.
 *
 * @param {string} instPath - An installation path
 * @param {string} keys - Keys to check existing
 * @returns {boolean} Whether `apm.json` has the property.
 */
function has(instPath, keys) {
  if (!keys) return false;

  const keysArray = keys.split('.');

  let object = getApmJson(instPath);
  for (const [i, key] of keysArray.entries()) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      object = object[key];
      if (object === null) {
        if (i !== keysArray.length - 1) {
          return false;
        }
        break;
      }
    } else {
      return false;
    }
  }
  return true;
}

/**
 * Gets the value from `apm.json`.
 *
 * @param {string} instPath - An installation path
 * @param {string} keys - Keys to get value
 * @param {any} defaultValue - A value replaced when the property don't exists.
 * @returns {any} The property selected by key.
 */
function get(instPath, keys = '', defaultValue = undefined) {
  const apmJson = getApmJson(instPath);

  if (keys === '') return apmJson;
  const keyArray = keys.split('.');

  let object = apmJson;
  for (const [i, key] of keyArray.entries()) {
    object = object[key];

    if (object === undefined) {
      break;
    } else if (object === null) {
      if (i !== keyArray.length - 1) {
        object = undefined;
      }
      break;
    }
  }
  return object === undefined ? defaultValue : object;
}

/**
 * Sets the value to `apm.json`.
 *
 * @param {string} instPath - An installation path
 * @param {string} keys - Keys to set value
 * @param {any} value - A value to set
 */
function set(instPath, keys, value = undefined) {
  if (!keys) return;

  const keyArray = keys.split('.');

  const rootObject = getApmJson(instPath);
  let object = rootObject;
  for (const [i, key] of keyArray.entries()) {
    if (i !== keyArray.length - 1) {
      if (!(typeof object[key] === 'object')) {
        object[key] = {};
      }
      object = object[key];
    } else {
      if (value !== undefined) object[key] = value;
      else delete object[key];
    }
  }
  setApmJson(instPath, rootObject);
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
 * @param {object} package - An information of a package
 */
function addPackage(instPath, package) {
  set(instPath, `packages.${package.id}`, {
    id: package.id,
    repository: package.repository,
    version: package.info.latestVersion,
  });
}

/**
 * Removes the information of the package from `apm.json`.
 *
 * @param {string} instPath - An installation path
 * @param {object} package - An information of a package
 */
function removePackage(instPath, package) {
  set(instPath, `packages.${package.id}`);
}

module.exports = { has, get, set, setCore, addPackage, removePackage };
