import { ipcRenderer } from 'electron';
import fs from 'fs-extra';
import path from 'path';
import Store from 'electron-store';
const store = new Store();
import log from 'electron-log';
import apmJson from '../lib/apmJson';

/**
 * Migration of common settings.
 *
 * @returns {Promise<boolean>} True on successful completion
 */
async function global() {
  // Guard condition
  const firstLaunch = !store.has('dataURL.main');
  if (firstLaunch) {
    store.set('dataVersion', '2');
    return true;
  }
  const isVerOne = !store.has('dataVersion');
  if (!isVerOne) return true;

  // Show the dialogs for those using custom dataURL.main
  let useDefaultDataURL = true;
  if (
    store.get('dataURL.main') !==
    'https://cdn.jsdelivr.net/gh/hal-shu-sato/apm-data@main/data/'
  ) {
    for (;;) {
      const response = await ipcRenderer.invoke('migration1to2-confirm-dialog');
      if (response === 0) {
        // quit
        return false;
      }
      if (response === 2) {
        // use default dataURL.main
        break;
      }
      // else (response === 1) // use new dataURL.main

      const newDataURL = await ipcRenderer.invoke(
        'migration1to2-dataurl-input-dialog'
      );
      if (!newDataURL) {
        continue;
      } else if (!newDataURL.startsWith('http') && !fs.existsSync(newDataURL)) {
        await ipcRenderer.invoke(
          'open-err-dialog',
          'エラー',
          '有効なURLまたは場所を入力してください。'
        );
        continue;
      } else if (path.extname(newDataURL) === '.xml') {
        await ipcRenderer.invoke(
          'open-err-dialog',
          'エラー',
          'フォルダのURLを入力してください。'
        );
        continue;
      } else {
        const oldDataURL = store.get('dataURL.main');
        const urls = store
          .get('dataURL.packages')
          .filter((url) => !url.includes(oldDataURL));
        urls.push(path.join(newDataURL, 'packages.xml'));
        store.set('dataURL.main', newDataURL);
        store.set('dataURL.packages', urls);
        store.set('migration1to2', {
          oldDataURL: oldDataURL,
          newDataURL: newDataURL,
        });
        useDefaultDataURL = false;
        break;
      }
    }
  }

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
  if (useDefaultDataURL) store.delete('dataURL.main');

  // Finalize
  store.set('dataVersion', '2');
  log.info('End of migration: migration1to2.global())');
  return true;
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
  if (!jsonExists) return;

  const isVerOne = !apmJson.has(instPath, 'dataVersion');
  if (!isVerOne) return;

  // Main
  log.info(`Start migration: migration1to2.byFolder(${instPath})`);

  // 1. Backup apm.json
  await ipcRenderer.invoke(
    'download',
    jsonPath,
    false,
    'migration1to2',
    jsonPath
  );

  // 2. Renaming the local repository
  try {
    if (fs.existsSync(path.join(instPath, 'packages_list.xml'))) {
      fs.renameSync(
        path.join(instPath, 'packages_list.xml'),
        path.join(instPath, 'packages.xml')
      );
    }
  } catch (e) {
    log.error(e);
  }

  // 3. Update the path to the online and local xml files.
  const packages = apmJson.get(instPath, 'packages');

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
    if (store.has('migration1to2')) {
      const dataURLs = store.get('migration1to2');
      text = text.replaceAll(
        path.join(dataURLs.oldDataURL, 'packages_list.xml'),
        path.join(dataURLs.newDataURL, 'packages.xml')
      );
    }
    packages[id].repository = text;
  }

  apmJson.set(instPath, 'packages', packages);

  // Finalize
  apmJson.set(instPath, 'dataVersion', '2');
  log.info(`End of migration: migration1to2.byFolder(${instPath})`);
}

const migration1to2 = {
  global,
  byFolder,
};
export default migration1to2;
