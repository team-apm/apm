import type { Packages } from 'apm-schema';
import { type BrowserWindow, dialog } from 'electron';
import log from 'electron-log/main';
import { existsSync, readJson } from 'fs-extra';
import path from 'node:path';
import type Config from '../../lib/Config';
import { detectPackageTypes } from '../../shared/packageUtil';
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
