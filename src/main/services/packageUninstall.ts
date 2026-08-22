import type { Packages } from 'apm-schema';
import log from 'electron-log/main';
import { existsSync, readJson, rm, writeJson } from 'fs-extra';
import path from 'node:path';
import { convertV1PackageIds } from '../../shared/packageId';
import { safeRemove } from '../../shared/safeRemove';
import { PackageState } from '../../types/packageState';
import type { Installation } from '../installation';
import { getIdDict } from './packageList';
import type { ServiceContext } from './serviceContext';

export type UninstallPackageResult = 'success' | 'removeFailed' | 'filesRemain';

/**
 * Removes the files of the package, removes it from the ledger, and (for
 * script-derived packages) removes it from the local packages.json.
 * 旧 src/renderer/main/package.ts の uninstallPackage の計算部分と同一の挙動
 * (削除失敗時のメッセージ表示は renderer 側の責務)。
 * @param {ServiceContext} ctx - The service context.
 * @param {Installation} inst - The target installation.
 * @param {object} packageState - A package to uninstall.
 * @returns {Promise<UninstallPackageResult>} The result of the uninstallation.
 */
export async function uninstallPackageFiles(
  ctx: ServiceContext,
  inst: Installation,
  packageState: Pick<PackageState, 'id' | 'info'>,
): Promise<UninstallPackageResult> {
  const filesToRemove = [];
  for (const file of packageState.info.files) {
    if (!file.isInstallOnly)
      filesToRemove.push(path.join(inst.path, file.filename));
  }

  try {
    await Promise.all(
      filesToRemove.map((filePath) => safeRemove(filePath, inst.path)),
    );
  } catch (e) {
    log.error(e);
    return 'removeFailed';
  }

  let filesCount = 0;
  let notExistCount = 0;
  for (const file of packageState.info.files) {
    if (!file.isInstallOnly) {
      filesCount++;
      if (!existsSync(path.join(inst.path, file.filename))) {
        notExistCount++;
      }
    }
  }

  const ledger = await inst.ledger();
  await ledger.removePackage(packageState.id);

  const result: UninstallPackageResult =
    filesCount === notExistCount ? 'success' : 'filesRemain';
  // スクリプト由来のパッケージはローカル packages.json からも削除する
  // (旧 renderer 側 parseJson.removePackage の呼び出しと同一の挙動)
  if (result === 'success' && packageState.id.startsWith('script_')) {
    await removeScriptPackage(ctx, inst, packageState.id);
  }
  return result;
}

/**
 * Removes the package entry from the local packages.json.
 * 旧 src/lib/parseJson.ts の removePackage と同一の挙動(データ v1 互換の
 * ID 変換込み。残りが無くなったらファイルごと削除)。
 * @param {ServiceContext} ctx - The service context.
 * @param {Installation} inst - The target installation.
 * @param {string} packageId - The id of the package to remove.
 */
async function removeScriptPackage(
  ctx: ServiceContext,
  inst: Installation,
  packageId: string,
) {
  const localPackagesPath = inst.localRepoPath;
  if (!existsSync(localPackagesPath))
    throw new Error('The version file does not exist.');
  const localPackages = ((await readJson(localPackagesPath)) as Packages)
    .packages;
  convertV1PackageIds(localPackages, await getIdDict(ctx));
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
