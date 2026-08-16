import log from 'electron-log/renderer';
import * as fs from 'fs-extra';
import path from 'node:path';
import ApmJson from '../../lib/ApmJson';
import { trpc } from '../../lib/trpcClient';
import {
  computePackagesStatus,
  getInstalledVersionOfPackage,
  getManuallyInstalledFiles,
  parsePackageType,
  states,
} from '../../shared/packageUtil';
import { ApmJsonObject } from '../../types/apmJson';
import { PackageItem } from '../../types/packageItem';

// 計算部分(states / parsePackageType / detectPackageTypes /
// getManuallyInstalledFiles / getInstalledVersionOfPackage /
// computePackagesStatus)は src/shared/packageUtil.ts へ移設済み

/**
 * Returns an object parsed from packages.json
 * 実装は main プロセス側(src/main/services/packages.ts)へ移設済み。
 * @param {string} instPath - An installation path
 * @returns {Promise<object[]>} - A list of object parsed from packages.json
 */
async function getPackages(instPath: string) {
  // tRPC の Serialize 型はプロパティを optional 化するため元の型に戻す
  return (await trpc.packages.getPackages.query(instPath)) as PackageItem[];
}

/**
 * Downloads the package data files.
 * 実装は main プロセス側(src/main/services/packages.ts)へ移設済み。
 * @param {string} instPath - An installation path
 */
async function downloadRepository(instPath: string) {
  await trpc.packages.downloadRepository.mutate(instPath);
}

/**
 * Returns a list of installed files.
 * @param {string} instPath - An installation path
 * @returns {string[]} List of installed files
 */
async function getInstalledFiles(instPath: string) {
  const regex = /^(?!exedit).*\.(auf|aui|auo|auc|aul|anm|obj|cam|tra|scn|lua)$/;
  const safeReaddir = async (path: string) => {
    try {
      return await fs.readdir(path, { withFileTypes: true });
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
 * Updates the installedVersion of the packages given as argument and returns a list of manually installed files
 * @param {object[]} _packages - A list of object parsed from packages.json
 * @param {string} instPath - An installation path
 * @returns {object} List of manually installed files
 */
async function getPackagesExtra(_packages: PackageItem[], instPath: string) {
  const packages = [..._packages].map((p) => {
    return { ...p };
  });
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
 * Updates the installedVersion of the packages given as argument and returns a list of manually installed files
 * @param {string} instPath - An installation path
 * @param {object[]} _packages - A list of object parsed from packages.json and getPackagesExtra()
 * @returns {object[]} - packages
 */
async function getPackagesStatus(instPath: string, _packages: PackageItem[]) {
  let aviUtlVer = '';
  let exeditVer = '';
  try {
    const apmJson = await ApmJson.load(instPath);
    aviUtlVer = (await apmJson.get('core.' + 'aviutl', '')) as string;
    exeditVer = (await apmJson.get('core.' + 'exedit', '')) as string;
  } catch (e) {
    log.info(e);
  }

  // 依存関係・競合の解決は shared/packageUtil.ts へ移設済み
  return computePackagesStatus(_packages, aviUtlVer, exeditVer);
}

const packageUtil = {
  states,
  parsePackageType,
  getPackages,
  downloadRepository,
  getPackagesExtra,
  getPackagesStatus,
};
export default packageUtil;
