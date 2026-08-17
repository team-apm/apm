import { trpc } from '../../lib/trpcClient';
import { parsePackageType, states } from '../../shared/packageUtil';
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
 * Updates the installedVersion of the packages and returns a list of
 * manually installed files.
 * 実装は main プロセス側(src/main/services/packages.ts)へ移設済み。
 * パッケージ一覧は main 側で取得するため引数は instPath のみ。
 * @param {string} instPath - An installation path
 * @returns {Promise<object>} List of manually installed files and packages
 */
async function getPackagesExtra(instPath: string) {
  // tRPC の Serialize 型はプロパティを optional 化するため元の型に戻す
  return (await trpc.packages.getPackagesExtra.query(instPath)) as {
    manuallyInstalledFiles: string[];
    packages: PackageItem[];
  };
}

/**
 * Returns the packages with their status (doNotInstall / detached) computed.
 * 実装は main プロセス側(src/main/services/packages.ts)へ移設済み。
 * @param {string} instPath - An installation path
 * @param {boolean} fixIntegrity - Whether to guess installed packages from integrity
 * @returns {Promise<object>} List of manually installed files and packages
 */
async function getPackagesWithStatus(instPath: string, fixIntegrity = false) {
  // tRPC の Serialize 型はプロパティを optional 化するため元の型に戻す
  return (await trpc.packages.getPackagesWithStatus.query({
    instPath,
    fixIntegrity,
  })) as {
    manuallyInstalledFiles: string[];
    packages: PackageItem[];
  };
}

const packageUtil = {
  states,
  parsePackageType,
  getPackages,
  downloadRepository,
  getPackagesExtra,
  getPackagesWithStatus,
};
export default packageUtil;
