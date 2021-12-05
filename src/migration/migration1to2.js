const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const Store = require('electron-store');
const store = new Store();
const log = require('electron-log');
const apmJson = require('../lib/apmJson');

/**
 * Returns the id conversion dictionary for the migration.
 *
 * @returns {Promise<string[]>} Dictionary of id relationships.
 */
async function getIdDict() {
  const convertJson = await ipcRenderer.invoke(
    'download',
    'https://cdn.jsdelivr.net/gh/hal-shu-sato/apm-data@main/v2/data/convert.json',
    true,
    'migration1to2'
  );
  return JSON.parse(fs.readFileSync(convertJson));
}

/**
 * Migration of common settings.
 *
 */
async function global() {
  // Guard condition
  const firstLaunch = !store.has('dataURL.main');
  if (firstLaunch) {
    store.set('dataVersion', '2');
    return;
  }
  const isVerOne = !store.has('dataVersion');
  if (!isVerOne) return;

  // Main
  log.info('Start migration: migration1to2.global())');
  // 1. Delete the cache files
  const dataFolder = path.join(
    await ipcRenderer.invoke('app-get-path', 'userData'),
    'Data/'
  );
  const files = [
    path.join(dataFolder, 'mod.xml'),
    path.join(dataFolder, 'core/core.xml'),
    ...fs
      .readdirSync(path.join(dataFolder, 'package/'), { withFileTypes: true })
      .filter(
        (dirent) =>
          dirent.isFile() && dirent.name.endsWith('_packages_list.xml')
      )
      .map(({ name }) => path.join(dataFolder, 'package/', name)),
  ];
  files.forEach((file) => {
    try {
      fs.unlinkSync(file);
    } catch (e) {
      log.error(e);
    }
  });

  // 2. Triggers initialization
  store.delete('modDate');
  // 3. Triggers initialization
  store.delete('dataURL.main');

  // Finalize
  store.set('dataVersion', '2');
}

/**
 * Migration of the AviUtl installation folder.
 *
 * @param {string} instPath - An installation path.
 */
async function byFolder(instPath) {
  // Guard condition
  const jsonPath = path.join(instPath, 'apm.json');
  const jsonExists = fs.existsSync(jsonPath);
  if (!jsonExists) {
    apmJson.set(instPath, 'dataVersion', '2');
    return;
  }
  const isVerOne = !apmJson.has(instPath, 'dataVersion');
  if (!isVerOne) return;

  // Main
  log.info(`Start migration: migration1to2.byFolder(${instPath})`);
  // 1. Renaming the local repository
  try {
    fs.renameSync(
      path.join(instPath, 'packages_list.xml'),
      path.join(instPath, 'packages.xml')
    );
  } catch (e) {
    log.error(e);
  }

  // step 2 and 3
  const packages = apmJson.get(instPath, 'packages');

  // 2. Update the path to the online and local xml files.
  for (const id of Object.keys(packages)) {
    let text = packages[id].repository;
    text = text.replaceAll(
      'apm-data@main\\data\\packages_list.xml',
      'apm-data@main\\v2\\data\\packages.xml'
    );
    text = text.replaceAll(
      'apm-data@main/data/packages_list.xml',
      'apm-data@main/v2/data/packages.xml'
    );
    text = text.replaceAll(
      path.join(instPath, 'packages_list.xml'),
      path.join(instPath, 'packages.xml')
    );
    packages[id].repository = text;
  }

  // 3. Convert id
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

  // Finish
  apmJson.set(instPath, 'dataVersion', '2');
}

module.exports = {
  getIdDict,
  global,
  byFolder,
};
