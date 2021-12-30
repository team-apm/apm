const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const setting = require('../setting/setting');
const mod = require('./mod');
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
 */
async function convertId(instPath) {
  const modDate = await mod.getInfo();
  if (!modDate.convert) return;

  const oldConvertMod = new Date(apmJson.get(instPath, 'convertMod', 0));

  if (modDate.convert.getTime() > oldConvertMod.getTime()) {
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
    apmJson.set(instPath, 'convertMod', modDate.convert.getTime());
  }
}

module.exports = convertId;
