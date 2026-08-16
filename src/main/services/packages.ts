import type { Packages } from 'apm-schema';
import { type BrowserWindow, dialog } from 'electron';
import log from 'electron-log/main';
import { existsSync, readdir as fsReaddir, readJson } from 'fs-extra';
import path from 'node:path';
import ApmJson from '../../lib/ApmJson';
import type Config from '../../lib/Config';
import { checkIntegrity } from '../../shared/integrity';
import {
  computePackagesStatus,
  detectPackageTypes,
  getInstalledVersionOfPackage,
  getManuallyInstalledFiles,
  states,
} from '../../shared/packageUtil';
import { ApmJsonObject } from '../../types/apmJson';
import { PackageItem } from '../../types/packageItem';
import { downloadFile } from './download';
import { getConvertDataUrl } from './modList';
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
 * 旧 src/lib/convertId.ts の getIdDict(update = false)と同一の挙動。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @returns {Promise<{ [key: string]: string }>} Dictionary of id relationships.
 */
async function getIdDict(
  win: BrowserWindow,
  config: Config,
): Promise<{ [key: string]: string }> {
  const dictUrl = await getConvertDataUrl(win, config);
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
        const convDict = await getIdDict(win, config);
        for (const packageInfo of packagesInfo) {
          // For compatibility with data v1
          if (Object.prototype.hasOwnProperty.call(convDict, packageInfo.id)) {
            packageInfo.id = convDict[packageInfo.id];
          }
        }
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
  // https://zenn.dev/repomn/scraps/d80ccd5c9183f0
  const asyncFlatMap = async <Item, Res>(
    arr: Item[],
    callback: (value: Item, index: number, array: Item[]) => Promise<Res>,
  ) => {
    const a = await Promise.all(arr.map(callback));
    return a.flat();
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
    const apmJson = await ApmJson.load(instPath);
    let modified = false;
    apmJson.begin();
    for (const p of packages.filter(
      (p) =>
        p.info.releases && p.installationStatus === states.manuallyInstalled,
    )) {
      for (const release of p.info.releases) {
        if (await checkIntegrity(instPath, release.integrity.file)) {
          await apmJson.addPackage(p.id, release.version);
          modified = true;
        }
      }
    }
    await apmJson.commit();
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
