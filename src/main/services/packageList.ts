import type { Packages } from 'apm-schema';
import { type BrowserWindow, dialog } from 'electron';
import log from 'electron-log/main';
import { existsSync, readdir as fsReaddir, readJson } from 'fs-extra';
import path from 'node:path';
import { asyncFlatMap } from '../../shared/asyncFlatMap';
import { checkIntegrity } from '../../shared/integrity';
import {
  convertV1ApmJsonPackages,
  convertV1PackageIds,
} from '../../shared/packageId';
import {
  computePackagesStatus,
  detectPackageTypes,
  getInstalledVersionOfPackage,
  getManuallyInstalledFiles,
  states,
} from '../../shared/packageUtil';
import { ApmJsonObject } from '../../types/apmJson';
import { PackageItem } from '../../types/packageItem';
import ApmJson from '../ApmJson';
import type Config from '../Config';
import { downloadFile } from './download';
import { getConvertDataUrl, getInfo, updateInfo } from './modList';
import { existsTempFile } from './tempFile';

/**
 * Returns package data files URLs.
 * 旧 src/lib/modList.ts の getPackagesDataUrl と同一の挙動
 * (設定の取得先 + instPath 直下の packages.json / editorPackages.json)。
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @returns {string[]} Package data files URLs.
 */
export function getPackagesDataUrl(config: Config, instPath: string) {
  return config.dataURL
    .getPackages()
    .concat(
      instPath && instPath.length > 0
        ? [
            path.join(instPath, 'packages.json'),
            path.join(instPath, 'editorPackages.json'),
          ].filter((p) => existsSync(p))
        : [],
    );
}

/**
 * Returns the id conversion dictionary.
 * 旧 src/lib/convertId.ts の getIdDict と同一の挙動。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {boolean} [update] - Download the json file.
 * @returns {Promise<{ [key: string]: string }>} Dictionary of id relationships.
 */
export async function getIdDict(
  win: BrowserWindow,
  config: Config,
  update = false,
): Promise<{ [key: string]: string }> {
  const dictUrl = await getConvertDataUrl(win, config);
  if (update) {
    const convertJson = await downloadFile(win, dictUrl, {
      subDir: 'package',
      keyText: dictUrl,
    });
    return convertJson ? await readJson(convertJson) : {};
  }
  const convertJson = existsTempFile(
    path.join('package', path.basename(dictUrl)),
    dictUrl,
  );
  if (convertJson.exists) {
    return await readJson(convertJson.path);
  } else {
    return {};
  }
}

/**
 * Converts the package ids in apm.json using the conversion dictionary.
 * 旧 src/lib/convertId.ts の convertId と同一の挙動(新 ID の解決に
 * packageItem.id を引く点も含めて維持)。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @param {number} modTime - A mod time.
 */
export async function convertPackageIds(
  win: BrowserWindow,
  config: Config,
  instPath: string,
  modTime: number,
) {
  const apmJson = await ApmJson.load(instPath);
  apmJson.begin();
  const packages = (await apmJson.get('packages')) as {
    [key: string]: { id: string };
  };

  const convDict = await getIdDict(win, config, true);
  convertV1ApmJsonPackages(packages, convDict);

  await apmJson.set('packages', packages);
  await apmJson.set('convertMod', modTime);
  await apmJson.commit();
}

/**
 * Returns an object parsed from packages.json
 * 旧 src/renderer/main/packageUtil.ts の getPackages
 * (+ src/lib/parseJson.ts の getPackages の ID 変換)と同一の挙動。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @returns {Promise<PackageItem[]>} - A list of object parsed from packages.json
 */
export async function getPackages(
  win: BrowserWindow,
  config: Config,
  instPath: string,
): Promise<PackageItem[]> {
  const jsonList: Packages['packages'][] = [];

  for (const packageRepository of getPackagesDataUrl(config, instPath)) {
    const packagesListFile = existsTempFile(
      `package/${path.basename(packageRepository)}`,
      packageRepository,
    );
    if (packagesListFile.exists) {
      try {
        const packagesInfo = (
          (await readJson(packagesListFile.path)) as Packages
        ).packages;
        convertV1PackageIds(packagesInfo, await getIdDict(win, config));
        jsonList.push(packagesInfo);
      } catch {
        log.error('Failed data processing.');
        await dialog.showMessageBox({
          title: 'データ解析エラー',
          message:
            '取得したデータの処理に失敗しました。' +
            '\n' +
            'URL: ' +
            packageRepository,
          type: 'error',
        });
      }
    }
  }

  const packages: PackageItem[] = [];
  for (const packagesInfo of jsonList) {
    for (const packageInfo of packagesInfo) {
      packages.push({
        id: packageInfo.id,
        info: packageInfo,
        type: detectPackageTypes(packageInfo.files),
      } as PackageItem);
    }
  }
  return packages;
}

/**
 * Returns a list of installed files.
 * 旧 src/renderer/main/packageUtil.ts の getInstalledFiles と同一の挙動。
 * @param {string} instPath - An installation path
 * @returns {Promise<string[]>} List of installed files
 */
async function getInstalledFiles(instPath: string) {
  const regex = /^(?!exedit).*\.(auf|aui|auo|auc|aul|anm|obj|cam|tra|scn|lua)$/;
  const safeReaddir = async (path: string) => {
    try {
      return await fsReaddir(path, { withFileTypes: true });
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      log.error(e);
      throw e;
    }
  };
  const readdir = async (dir: string) =>
    (await safeReaddir(dir))
      .filter((i) => i.isFile() && regex.test(i.name))
      .map((i) => i.name);
  return (await readdir(instPath)).concat(
    (await readdir(path.join(instPath, 'plugins'))).map((i) => 'plugins/' + i),
    (await readdir(path.join(instPath, 'script'))).map((i) => 'script/' + i),
    await asyncFlatMap(
      (await safeReaddir(path.join(instPath, 'script')))
        .filter((i) => i.isDirectory())
        .map((i) => 'script/' + i.name),
      async (i) =>
        (await readdir(path.join(instPath, i))).map((j) => i + '/' + j),
    ),
  );
}

/**
 * Updates the installedVersion of the packages and returns a list of
 * manually installed files.
 * 旧 src/renderer/main/packageUtil.ts の getPackagesExtra と同一の挙動
 * (パッケージ一覧は main 側の getPackages から取得する)。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @returns {Promise<object>} List of manually installed files and packages.
 */
export async function getPackagesExtra(
  win: BrowserWindow,
  config: Config,
  instPath: string,
): Promise<{ manuallyInstalledFiles: string[]; packages: PackageItem[] }> {
  const packages = await getPackages(win, config, instPath);
  const apmJson = await ApmJson.load(instPath);
  const tmpInstalledPackages = (await apmJson.get(
    'packages',
  )) as ApmJsonObject['packages'];
  const tmpInstalledFiles = await getInstalledFiles(instPath);
  const tmpManuallyInstalledFiles = getManuallyInstalledFiles(
    tmpInstalledFiles,
    tmpInstalledPackages,
    packages,
  );
  packages.forEach((p) => {
    [p.installationStatus, p.version] = getInstalledVersionOfPackage(
      p,
      tmpInstalledFiles,
      tmpManuallyInstalledFiles,
      tmpInstalledPackages,
      instPath,
    );
  });
  return {
    manuallyInstalledFiles: tmpManuallyInstalledFiles,
    packages: packages,
  };
}

/**
 * Records the packages whose release integrity matches an installed file as
 * installed in apm.json, and returns whether apm.json was modified.
 * 旧 getPackagesWithStatus 内の fixIntegrity 分岐の切り出し(挙動同一)。
 * @param {string} instPath - An installation path.
 * @param {PackageItem[]} packages - Packages with their installation status.
 * @returns {Promise<boolean>} Whether apm.json was modified.
 */
export async function adoptManuallyInstalledPackages(
  instPath: string,
  packages: PackageItem[],
): Promise<boolean> {
  const apmJson = await ApmJson.load(instPath);
  let modified = false;
  apmJson.begin();
  for (const p of packages.filter(
    (p) => p.info.releases && p.installationStatus === states.manuallyInstalled,
  )) {
    for (const release of p.info.releases) {
      if (await checkIntegrity(instPath, release.integrity.file)) {
        await apmJson.addPackage(p.id, release.version);
        modified = true;
      }
    }
  }
  await apmJson.commit();
  return modified;
}

/**
 * Returns the packages with their status (doNotInstall / detached) computed.
 * 旧 src/renderer/main/package.ts の setPackagesList 前半
 * (getPackages → getPackagesExtra → 整合性による apm.json 補正 →
 * getPackagesStatus)と同一の挙動。fixIntegrity = false の場合は
 * 補正を行わない(旧 installScript の redirect 解決と同一)。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @param {boolean} fixIntegrity - Whether to guess installed packages from integrity.
 * @returns {Promise<object>} List of manually installed files and packages.
 */
export async function getPackagesWithStatus(
  win: BrowserWindow,
  config: Config,
  instPath: string,
  fixIntegrity: boolean,
): Promise<{ manuallyInstalledFiles: string[]; packages: PackageItem[] }> {
  let { manuallyInstalledFiles, packages } = await getPackagesExtra(
    win,
    config,
    instPath,
  );

  if (fixIntegrity) {
    // guess which packages are installed from integrity
    const modified = await adoptManuallyInstalledPackages(instPath, packages);
    if (modified) {
      const packagesExtraMod = await getPackagesExtra(win, config, instPath);
      manuallyInstalledFiles = packagesExtraMod.manuallyInstalledFiles;
      packages = packagesExtraMod.packages;
    }
  }

  let aviUtlVer = '';
  let exeditVer = '';
  try {
    const apmJson = await ApmJson.load(instPath);
    aviUtlVer = (await apmJson.get('core.' + 'aviutl', '')) as string;
    exeditVer = (await apmJson.get('core.' + 'exedit', '')) as string;
  } catch (e) {
    log.info(e);
  }
  packages = computePackagesStatus(packages, aviUtlVer, exeditVer);

  return { manuallyInstalledFiles, packages };
}

/**
 * Downloads the package data files.
 * 旧 src/renderer/main/packageUtil.ts の downloadRepository と同一の挙動。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 */
export async function downloadRepository(
  win: BrowserWindow,
  config: Config,
  instPath: string,
) {
  // 'electron-dl' does not download all files when downloading them asynchronously.
  for (const packageRepository of getPackagesDataUrl(config, instPath)) {
    await downloadFile(win, packageRepository, {
      subDir: 'package',
      keyText: packageRepository,
    });
  }
}

/**
 * Refreshes the packages data: re-downloads list.json and the package
 * repositories, and records the check/mod dates.
 * 旧 src/renderer/main/package.ts の checkPackagesList のデータ取得部分と
 * 同一の挙動。ボタン・オーバーレイなどの UI は renderer 側に残る。
 * @param {BrowserWindow} win - The main window.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 */
export async function refreshPackagesList(
  win: BrowserWindow,
  config: Config,
  instPath: string,
) {
  await updateInfo(win, config);
  await downloadRepository(win, config, instPath);
  config.checkDate.setPackages(Date.now());
  const modInfo = await getInfo(win, config);
  config.modDate.setPackages(
    Math.max(...modInfo.packages.map((p) => new Date(p.modified).getTime())),
  );
}

/**
 * Returns the mod/check dates of the packages data, or null if not fetched.
 * 旧 src/renderer/main/package.ts の updateModDates が読んでいた
 * config 値と同一(modDate が無ければ null)。
 * @param {Config} config - The config instance.
 * @returns {{ modDate: number; checkDate: number } | null} The dates.
 */
export function getPackagesDates(
  config: Config,
): { modDate: number; checkDate: number } | null {
  if (!config.modDate.hasPackages()) return null;
  return {
    modDate: config.modDate.getPackages(),
    checkDate: config.checkDate.getPackages(),
  };
}

/**
 * Returns the subset of the given package ids recorded in apm.json.
 * 旧 displayNicommonsIdList の apmJson.has('packages.' + id) 判定と同一の挙動
 * (dot-prop のパス解釈に依存するため判定ごと main 側で行う)。
 * @param {string} instPath - An installation path.
 * @param {string[]} ids - Package ids to check.
 * @returns {Promise<string[]>} The ids recorded in apm.json.
 */
export async function getApmJsonInstalledIds(instPath: string, ids: string[]) {
  const apmJson = await ApmJson.load(instPath);
  const result: string[] = [];
  for (const id of ids) {
    if (await apmJson.has('packages.' + id)) result.push(id);
  }
  return result;
}
