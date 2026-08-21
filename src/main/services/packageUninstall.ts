import type { Packages } from 'apm-schema';
import type { BrowserWindow } from 'electron';
import log from 'electron-log/main';
import { existsSync, readJson, rm, writeJson } from 'fs-extra';
import path from 'node:path';
import { convertV1PackageIds } from '../../shared/packageId';
import { safeRemove } from '../../shared/safeRemove';
import { PackageItem } from '../../types/packageItem';
import ApmJson from '../ApmJson';
import type Config from '../Config';
import { getIdDict } from './packageList';

export type UninstallPackageResult = 'success' | 'removeFailed' | 'filesRemain';

/**
 * Removes the files of the package, removes it from apm.json, and (for
 * script-derived packages) removes it from the local packages.json.
 * 旧 src/renderer/main/package.ts の uninstallPackage の計算部分と同一の挙動
 * (削除失敗時のメッセージ表示は renderer 側の責務)。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @param {object} packageItem - A package to uninstall.
 * @returns {Promise<UninstallPackageResult>} The result of the uninstallation.
 */
export async function uninstallPackageFiles(
  win: BrowserWindow,
  config: Config,
  instPath: string,
  packageItem: Pick<PackageItem, 'id' | 'info'>,
): Promise<UninstallPackageResult> {
  const filesToRemove = [];
  for (const file of packageItem.info.files) {
    if (!file.isInstallOnly)
      filesToRemove.push(path.join(instPath, file.filename));
  }

  try {
    await Promise.all(
      filesToRemove.map((filePath) => safeRemove(filePath, instPath)),
    );
  } catch (e) {
    log.error(e);
    return 'removeFailed';
  }

  let filesCount = 0;
  let notExistCount = 0;
  for (const file of packageItem.info.files) {
    if (!file.isInstallOnly) {
      filesCount++;
      if (!existsSync(path.join(instPath, file.filename))) {
        notExistCount++;
      }
    }
  }

  const apmJson = await ApmJson.load(instPath);
  await apmJson.removePackage(packageItem.id);

  const result: UninstallPackageResult =
    filesCount === notExistCount ? 'success' : 'filesRemain';
  // スクリプト由来のパッケージはローカル packages.json からも削除する
  // (旧 renderer 側 parseJson.removePackage の呼び出しと同一の挙動)
  if (result === 'success' && packageItem.id.startsWith('script_')) {
    await removeScriptPackage(win, config, instPath, packageItem.id);
  }
  return result;
}

/**
 * Removes the package entry from the local packages.json.
 * 旧 src/lib/parseJson.ts の removePackage と同一の挙動(データ v1 互換の
 * ID 変換込み。残りが無くなったらファイルごと削除)。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @param {string} packageId - The id of the package to remove.
 */
async function removeScriptPackage(
  win: BrowserWindow,
  config: Config,
  instPath: string,
  packageId: string,
) {
  const localPackagesPath = path.join(instPath, 'packages.json');
  if (!existsSync(localPackagesPath))
    throw new Error('The version file does not exist.');
  const localPackages = ((await readJson(localPackagesPath)) as Packages)
    .packages;
  convertV1PackageIds(localPackages, await getIdDict(win, config));
  const newLocalPackages = localPackages.filter((p) => p.id !== packageId);
  if (newLocalPackages.length > 0) {
    await writeJson(localPackagesPath, {
      version: 3,
      packages: newLocalPackages,
    });
  } else {
    await rm(localPackagesPath);
  }
}
