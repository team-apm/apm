import log from 'electron-log';
import fs, { writeJson } from 'fs-extra';
import path from 'node:path';
import ApmJson from '../lib/ApmJson';
import Config from '../lib/Config';
import { download, openDialog } from '../lib/ipcWrapper';
import migration1to2 from './migration1to2';
import parseXML from './parseXML';
const config = new Config();

/**
 * Migration of common settings.
 * @returns {Promise<boolean>} True on successful completion
 */
async function global(): Promise<boolean> {
  const firstLaunch = !config.dataURL.hasMain();
  if (firstLaunch) {
    config.setDataVersion('3');
    return true;
  }

  // First, perform the previous migration.
  // false cancels startup
  if (!(await migration1to2.global())) return false;

  // Guard condition
  // The 'dataVersion' is always present due to previous migrations.
  // version: '2' or '3' or later
  const version = config.getDataVersion();
  if (version !== '2') return true;

  // Main
  log.info('Start migration: migration2to3.global())');

  // 1. Triggers initialization
  config.delete('modDate');
  config.delete('checkDate');
  config.delete('dataURL');

  // Finalize
  config.setDataVersion('3');
  await openDialog(
    'アップデート',
    'v2.x.xからv3.x.xへのアップデートに伴い、データ取得先がリセットされました。\nデフォルト以外のURLを設定していた場合は、再設定してください。',
    'info',
  );
  log.info('End of migration: migration2to3.global())');
  return true;
}

/**
 * Migration of the AviUtl installation folder.
 * @param {string} instPath - An installation path.
 */
async function byFolder(instPath: string) {
  const jsonPath = path.join(instPath, 'apm.json');
  const jsonExists = fs.existsSync(jsonPath);
  if (!jsonExists) return;

  await migration1to2.byFolder(instPath);

  // Guard condition
  // The 'dataVersion' is always present due to previous migrations.
  // version: '2' or '3' or later
  const apmJson = await ApmJson.load(instPath);
  const version = (await apmJson.get('dataVersion')) as string;
  if (version !== '2') return;

  // Main
  log.info(`Start migration: migration2to3.byFolder(${instPath})`);

  // 1. Backup apm.json
  await download(jsonPath, { subDir: 'migration2to3', keyText: jsonPath });

  // 2. Update the path to the online and local xml files.
  const packages = (await apmJson.get('packages')) as {
    [key: string]: { repository: string };
  };
  for (const id of Object.keys(packages)) {
    if (Object.hasOwn(packages[id], 'repository'))
      delete packages[id].repository;
  }
  await apmJson.set('packages', packages);

  // 3. Conversion of package.xml generated by the script installation function
  const packagesXML = path.join(instPath, 'packages.xml');
  if (fs.existsSync(packagesXML)) {
    const packagesList = await parseXML.getPackages(packagesXML);

    try {
      let v3Packages = JSON.parse(
        JSON.stringify(Object.values(packagesList)).replaceAll(
          'isOptional',
          'isUninstallOnly',
        ),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      v3Packages = v3Packages.map((p: any) => {
        if (p?.dependencies?.dependency)
          p.dependencies = p.dependencies.dependency;
        if (p?.releases)
          p.releases = Object.entries(p.releases).map(([k, v]) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return { ...(v as any), version: k };
          });
        return p;
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      v3Packages = v3Packages.map((p: any) => {
        if (p.releases) {
          for (const release of p.releases) {
            if (release.integrities) {
              release.integrity = { file: release.integrities };
              delete release.integrities;
              for (const file of release.integrity.file) {
                file.hash = file.targetIntegrity;
                delete file.targetIntegrity;
              }
            }
            if (release.archiveIntegrity) {
              release.integrity.archive = release.archiveIntegrity;
              delete release.archiveIntegrity;
            }
          }
        }
        p.downloadURLs = [p.downloadURL];
        delete p.downloadURL;
        if (p.downloadMirrorURL) {
          p.downloadURLs.push(p.downloadMirrorURL);
          delete p.downloadMirrorURL;
        }
        return p;
      });
      const newData = { version: 3, packages: v3Packages };
      await writeJson(path.join(instPath, 'packages.json'), newData);
    } catch (e) {
      log.error(e);
    }
  }

  // Finalize
  await apmJson.set('dataVersion', '3');
  log.info(`End of migration: migration2to3.byFolder(${instPath})`);
}

const migration2to3 = {
  global,
  byFolder,
};
export default migration2to3;
