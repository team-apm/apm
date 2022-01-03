const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const setting = require('../setting/setting');
const apmJson = require('./apmJson');

/**
 * Returns the id conversion dictionary.
 *
 * @returns {Promise<object>} Dictionary of id relationships.
 */
async function getIdDict() {
  const dictUrl = path.join(setting.getDataUrl(), 'convert.json');
  const convertJson = await ipcRenderer.invoke(
    'download',
    dictUrl,
    true,
    'package',
    dictUrl
  );
  return fs.readJsonSync(convertJson);
}

/**
 * Converts id.
 *
 * @param {string} instPath - An installation path
 * @param {number} modTime - A mod time.
 */
async function convertId(instPath, modTime) {
  const packages = apmJson.get(instPath, 'packages');

  const convDict = await getIdDict();
  for (const [oldId, package] of Object.entries(packages)) {
    if (Object.prototype.hasOwnProperty.call(convDict, oldId)) {
      const newId = convDict[package.id];
      packages[newId] = packages[oldId];
      delete packages[oldId];
      packages[newId].id = newId;
    }
  }

  apmJson.set(instPath, 'packages', packages);
  apmJson.set(instPath, 'convertMod', modTime);
}

module.exports = { convertId };
