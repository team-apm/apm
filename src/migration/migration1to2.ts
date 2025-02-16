import log from 'electron-log';
import { existsSync, readdir, rename, unlink } from 'fs-extra';
import path from 'node:path';
import ApmJson from '../lib/ApmJson';
import Config from '../lib/Config';
import {
  app,
  download,
  migration1to2ConfirmDialog,
  migration1to2DataurlInputDialog,
  openDialog,
} from '../lib/ipcWrapper';
const config = new Config();

/**
 * Migration of common settings.
 * @returns {Promise<boolean>} True on successful completion
 */
async function global() {
  // Guard condition
  const isVerOne = !config.hasDataVersion();
  if (!isVerOne) return true;

  // Show the dialogs for those using custom dataURL.main
  let useDefaultDataURL = true;
  if (
    config.dataURL.getMain() !==
    'https://cdn.jsdelivr.net/gh/team-apm/apm-data@main/data/'
  ) {
    for (;;) {
      const response = await migration1to2ConfirmDialog();
      if (response === 0) {
        // quit
        return false;
      }
      if (response === 2) {
        // use default dataURL.main
        break;
      }
      // else (response === 1) // use new dataURL.main

      const newDataURL = await migration1to2DataurlInputDialog();
      if (!newDataURL) {
        continue;
      } else if (!newDataURL.startsWith('http') && !existsSync(newDataURL)) {
        await openDialog(
          'エラー',
          '有効なURLまたは場所を入力してください。',
          'error',
        );
        continue;
      } else if (path.extname(newDataURL) === '.xml') {
        await openDialog(
          'エラー',
          'フォルダのURLを入力してください。',
          'error',
        );
        continue;
      } else {
        const oldDataURL = config.dataURL.getMain();
        const urls = config.dataURL
          .getPackages()
          .filter((url) => !url.includes(oldDataURL));
        urls.push(path.join(newDataURL, 'packages.xml'));
        config.dataURL.setMain(newDataURL);
        config.dataURL.setPackages(urls);
        config.set('migration1to2', {
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
  const dataFolder = path.join(await app.getPath('userData'), 'Data/');
  const files = [
    path.join(dataFolder, 'mod.xml'),
    path.join(dataFolder, 'core/core.xml'),
    ...(
      await readdir(path.join(dataFolder, 'package/'), {
        withFileTypes: true,
      })
    )
      .filter(
        (dirent) =>
          dirent.isFile() && dirent.name.endsWith('_packages_list.xml'),
      )
      .map(({ name }) => path.join(dataFolder, 'package/', name)),
  ];
  files.forEach(async (file) => {
    try {
      await unlink(file);
    } catch (e) {
      log.error(e);
    }
  });

  // 2. Triggers initialization
  config.delete('modDate');
  // 3. Triggers initialization
  if (useDefaultDataURL) config.dataURL.setMain(undefined);

  // Finalize
  config.setDataVersion('2');
  log.info('End of migration: migration1to2.global())');
  return true;
}

/**
 * Migration of the AviUtl installation folder.
 * @param {string} instPath - An installation path.
 */
async function byFolder(instPath: string) {
  // Guard condition
  const jsonPath = ApmJson.getPath(instPath);
  const jsonExists = existsSync(jsonPath);
  if (!jsonExists) return;

  const apmJson = await ApmJson.load(instPath);
  const isVerOne = !(await apmJson.has('dataVersion'));
  if (!isVerOne) return;

  // Main
  log.info(`Start migration: migration1to2.byFolder(${instPath})`);

  // 1. Backup apm.json
  await download(jsonPath, { subDir: 'migration1to2', keyText: jsonPath });

  // 2. Renaming the local repository
  try {
    if (existsSync(path.join(instPath, 'packages_list.xml'))) {
      await rename(
        path.join(instPath, 'packages_list.xml'),
        path.join(instPath, 'packages.xml'),
      );
    }
  } catch (e) {
    log.error(e);
  }

  // 3. Update the path to the online and local xml files.
  const packages = (await apmJson.get('packages')) as {
    [key: string]: { repository: string };
  };

  for (const id of Object.keys(packages)) {
    let text = packages[id].repository;
    text = text.replaceAll(
      'apm-data@main\\data\\packages_list.xml',
      'apm-data@main\\v2\\data\\packages.xml',
    );
    text = text.replaceAll(
      'apm-data@main/data/packages_list.xml',
      'apm-data@main/v2/data/packages.xml',
    );
    text = text.replaceAll(
      path.join(instPath, 'packages_list.xml'),
      path.join(instPath, 'packages.xml'),
    );
    if (config.has('migration1to2')) {
      const dataURLs = config.get('migration1to2');
      text = text.replaceAll(
        path.join(dataURLs.oldDataURL, 'packages_list.xml'),
        path.join(dataURLs.newDataURL, 'packages.xml'),
      );
    }
    packages[id].repository = text;
  }

  await apmJson.set('packages', packages);

  // Finalize
  await apmJson.set('dataVersion', '2');
  log.info(`End of migration: migration1to2.byFolder(${instPath})`);
}

const migration1to2 = {
  global,
  byFolder,
};
export default migration1to2;
