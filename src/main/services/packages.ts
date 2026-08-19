import type { Packages, Scripts } from 'apm-schema';
import { app, type BrowserWindow, dialog, shell } from 'electron';
import log from 'electron-log/main';
import {
  copy,
  existsSync,
  readdir as fsReaddir,
  mkdir,
  readJson,
  rename,
  rm,
  writeJson,
} from 'fs-extra';
import * as matcher from 'matcher';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { isParent } from '../../shared/apmPath';
import { getHash } from '../../shared/getHash';
import { install, verifyFilesByCount } from '../../shared/install';
import { checkIntegrity, verifyFile } from '../../shared/integrity';
import {
  computePackagesStatus,
  detectPackageTypes,
  getInstalledVersionOfPackage,
  getManuallyInstalledFiles,
  states,
} from '../../shared/packageUtil';
import { programs } from '../../shared/programs';
import { safeRemove } from '../../shared/safeRemove';
import { shareStringVersion } from '../../shared/shareString';
import unzip from '../../shared/unzip';
import { ApmJsonObject } from '../../types/apmJson';
import { PackageItem } from '../../types/packageItem';
import ApmJson from '../ApmJson';
import type Config from '../Config';
import { openBrowser } from './browser';
import { downloadFile } from './download';
import {
  getConvertDataUrl,
  getInfo,
  getScriptsDataUrl,
  updateInfo,
} from './modList';
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
async function getIdDict(
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
  for (const [oldId, packageItem] of Object.entries(packages)) {
    if (Object.prototype.hasOwnProperty.call(convDict, oldId)) {
      const newId = convDict[packageItem.id];
      packages[newId] = packages[oldId];
      delete packages[oldId];
      packages[newId].id = newId;
    }
  }

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

/**
 * Returns an object parsed from scripts.json.
 * 旧 src/renderer/main/package.ts の getScriptsList と同一の挙動。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {boolean} update - Download the json file.
 * @returns {Promise<{webpage: Scripts['webpage']; scripts: Scripts['scripts']}>} An object parsed from scripts.json.
 */
export async function getScriptsList(
  win: BrowserWindow,
  config: Config,
  update: boolean,
) {
  const dictUrl = await getScriptsDataUrl(win, config);
  const result: { webpage: Scripts['webpage']; scripts: Scripts['scripts'] } = {
    webpage: [],
    scripts: [],
  };

  for (const url of dictUrl) {
    const scriptsJson = await downloadFile(win, url, {
      loadCache: !update,
      subDir: 'package',
      keyText: url,
    });
    if (!scriptsJson) continue;
    const json: Scripts = await readJson(scriptsJson);
    result.webpage = result.webpage.concat(json.webpage);
    result.scripts = result.scripts.concat(json.scripts);
  }

  if (update) {
    const currentMod = await getInfo(win, config);
    config.modDate.setScripts(
      Math.max(
        ...currentMod.scripts.map((p) => new Date(p.modified).getTime()),
      ),
    );
  }

  return result;
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

/**
 * Get the date today
 * 旧 src/renderer/main/package.ts の getDate と同一の挙動。
 * @returns {string} Today's date
 */
function getDate() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(
    2,
    '0',
  )}/${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Unzips (or moves) the downloaded archive, installs the files and records
 * the package in apm.json.
 * 旧 src/renderer/main/package.ts の installPackage 後半
 * (展開 → インストーラ実行または配置 → 検証 → apm.json 記録)と同一の挙動。
 * @param {string} instPath - An installation path.
 * @param {string} archivePath - Path to the downloaded archive.
 * @param {object} packageItem - A package to install.
 * @returns {Promise<boolean>} Whether the installation succeeded.
 */
export async function installPackageArchive(
  instPath: string,
  archivePath: string,
  packageItem: Pick<PackageItem, 'id' | 'info'>,
): Promise<boolean> {
  let installResult = false;

  try {
    const getUnzippedPath = async () => {
      if (['.zip', '.lzh', '.7z', '.rar'].includes(path.extname(archivePath))) {
        return await unzip(archivePath, packageItem.id);
      } else {
        // In this line, path.dirname(archivePath) always refers to the 'Data/package' folder.
        const newFolder = path.join(path.dirname(archivePath), packageItem.id);
        await mkdir(newFolder, { recursive: true });
        await rename(
          archivePath,
          path.join(newFolder, path.basename(archivePath)),
        );
        return newFolder;
      }
    };

    const unzippedPath = await getUnzippedPath();

    if (packageItem.info.installer) {
      const searchFiles = async (dirName: string) => {
        let result: string[][] = [];
        const dirents = await fsReaddir(dirName, {
          withFileTypes: true,
        });
        for (const dirent of dirents) {
          if (dirent.isDirectory()) {
            const childResult = await searchFiles(
              path.join(dirName, dirent.name),
            );
            result = result.concat(childResult);
          } else {
            if (dirent.name === packageItem.info.installer) {
              result.push([path.join(dirName, dirent.name)]);
              break;
            }
          }
        }
        return result;
      };

      const exePath = await searchFiles(unzippedPath);
      const command =
        '"' +
        exePath[0][0] +
        '" ' +
        packageItem.info.installArg
          .replace('"$instpath"', '$instpath')
          .replace('$instpath', '"' + instPath + '"'); // Prevent double quoting
      execSync(command);

      installResult = verifyFilesByCount(instPath, packageItem.info.files);
    } else {
      installResult = await install(
        unzippedPath,
        instPath,
        packageItem.info.files,
      );
    }
  } catch (e) {
    log.error(e);
    installResult = false;
  }

  if (installResult) {
    // isContinuous のパッケージはインストール日をバージョンとして記録する
    const latestVersion = packageItem.info.isContinuous
      ? getDate()
      : packageItem.info.latestVersion;
    const apmJson = await ApmJson.load(instPath);
    await apmJson.addPackage(packageItem.id, latestVersion);
  }

  return installResult;
}

export type InstallPackageResult =
  | 'success'
  | 'canceled'
  | 'downloadFailed'
  | 'corrupt'
  | 'redownloadFailed'
  | 'installFailed';

/**
 * Resolves the archive (local file / direct link / interactive browser) and
 * installs the package.
 * 旧 src/renderer/main/package.ts の installPackage のアーカイブ解決部分と
 * 同一の挙動。UI(ボタン遷移・メッセージ表示)は renderer 側に残る。
 * @param {BrowserWindow} win - A browser window used for downloads and dialogs.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @param {Pick<PackageItem, 'id' | 'info'>} packageItem - The package to install.
 * @param {object} [options] - Options.
 * @param {boolean} [options.direct] - Install from the direct link to the zip.
 * @param {string} [options.archivePath] - Path to the already-downloaded archive.
 * @returns {Promise<InstallPackageResult>} The result status.
 */
export async function installPackageFlow(
  win: BrowserWindow,
  config: Config,
  instPath: string,
  packageItem: Pick<PackageItem, 'id' | 'info'>,
  { direct = false, archivePath }: { direct?: boolean; archivePath?: string },
): Promise<InstallPackageResult> {
  let resolvedArchivePath = '';
  if (archivePath) {
    resolvedArchivePath = archivePath;
  } else if (direct) {
    resolvedArchivePath = await downloadFile(win, packageItem.info.directURL, {
      loadCache: true,
      subDir: 'package',
    });

    if (!resolvedArchivePath) {
      log.error('Failed downloading a file.');
      return 'downloadFailed';
    }

    const integrityForArchive = packageItem.info.releases?.find(
      (r) => r.version === packageItem.info.latestVersion,
    )?.integrity?.archive;

    if (integrityForArchive) {
      // Verify file integrity
      while (!(await verifyFile(resolvedArchivePath, integrityForArchive))) {
        const dialogResult =
          (
            await dialog.showMessageBox(win, {
              title: 'エラー',
              message:
                'ダウンロードされたファイルは破損しています。再ダウンロードしますか？',
              type: 'warning',
              buttons: ['はい', 'いいえ'],
              cancelId: 1,
            })
          ).response === 0;

        if (!dialogResult) {
          log.error(
            `The downloaded archive file is corrupt. URL:${packageItem.info.directURL}`,
          );
          return 'corrupt';
        }

        // 再ダウンロード先が subDir 'core' なのは旧実装のままの挙動
        resolvedArchivePath = await downloadFile(
          win,
          packageItem.info.directURL,
          { subDir: 'core' },
        );
        if (!resolvedArchivePath) {
          log.error(
            `Failed downloading the archive file. URL:${packageItem.info.directURL}`,
          );
          return 'redownloadFailed';
        }
      }
    }
  } else {
    const downloadResult = await openBrowser(
      win,
      packageItem.info.downloadURLs[0],
      'package',
    );

    if (!downloadResult) {
      log.info('The installation was canceled.');
      return 'canceled';
    }

    resolvedArchivePath = downloadResult.savePath;
  }

  const installResult = await installPackageArchive(
    instPath,
    resolvedArchivePath,
    packageItem,
  );
  return installResult ? 'success' : 'installFailed';
}

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
  const convDict = await getIdDict(win, config);
  for (const localPackage of localPackages) {
    // For compatibility with data v1
    if (Object.prototype.hasOwnProperty.call(convDict, localPackage.id)) {
      localPackage.id = convDict[localPackage.id];
    }
  }
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

// To avoid a bug in the library
// https://github.com/sindresorhus/matcher/issues/32
const isMatch = (
  input: string | readonly string[],
  pattern: readonly string[],
) => pattern.some((p) => matcher.isMatch(input, p));

export type InstallScriptResult =
  'success' | 'noScript' | 'containsPlugin' | 'installFailed';

/**
 * Unzips the downloaded script archive, verifies and copies the script files,
 * and records the generated package in the local packages.json and apm.json.
 * 旧 src/renderer/main/package.ts の installScript 後半
 * (展開 → スクリプト有無の検証 → 配置 → パッケージ情報の生成と保存)と
 * 同一の挙動。ローカル packages.json への追記は旧 parseJson.addPackage 相当
 * (データ v1 互換の ID 変換込み)。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @param {string} archivePath - Path to the downloaded archive.
 * @param {string} url - The URL of the script distribution page.
 * @param {object} matchInfo - The matched script information.
 * @param {string} matchInfo.folder - A folder name to copy the scripts into.
 * @param {string} [matchInfo.developer] - The developer of the script.
 * @param {string[]} [matchInfo.dependencies] - Dependencies of the script.
 * @returns {Promise<InstallScriptResult>} The result of the installation.
 */
export async function installScriptArchive(
  win: BrowserWindow,
  config: Config,
  instPath: string,
  archivePath: string,
  url: string,
  matchInfo: { folder: string; developer?: string; dependencies?: string[] },
): Promise<InstallScriptResult> {
  const pluginExtRegex = /\.(auf|aui|auo|auc|aul)$/;
  const scriptExtRegex = /\.(anm|obj|cam|tra|scn)$/;

  // https://zenn.dev/repomn/scraps/d80ccd5c9183f0
  const asyncFlatMap = async <Item, Res>(
    arr: Item[],
    callback: (value: Item, index: number, array: Item[]) => Promise<Res>,
  ) => {
    const a = await Promise.all(arr.map(callback));
    return a.flat();
  };

  const searchScriptRoot = async (dirName: string): Promise<string[]> => {
    const dirents = await fsReaddir(dirName, {
      withFileTypes: true,
    });
    return dirents.find((i) => i.isFile() && scriptExtRegex.test(i.name))
      ? [dirName]
      : await asyncFlatMap(
          dirents.filter((i) => i.isDirectory()),
          (i) => searchScriptRoot(path.join(dirName, i.name)),
        );
  };

  const extExists = async (
    dirName: string,
    regex: RegExp,
  ): Promise<boolean> => {
    const dirents = await fsReaddir(dirName, {
      withFileTypes: true,
    });
    return dirents.filter((i) => i.isFile() && regex.test(i.name)).length > 0
      ? true
      : (
          await asyncFlatMap(
            dirents.filter((i) => i.isDirectory()),
            (i) => extExists(path.join(dirName, i.name), regex),
          )
        ).some((e) => e);
  };

  try {
    const getUnzippedPath = async () => {
      if (['.zip', '.lzh', '.7z', '.rar'].includes(path.extname(archivePath))) {
        return await unzip(archivePath);
      } else {
        // In this line, path.dirname(archivePath) always refers to the 'Data/package' folder.
        const newFolder = path.join(
          path.dirname(archivePath),
          'tmp_' + path.basename(archivePath),
        );
        await mkdir(newFolder, { recursive: true });
        await rename(
          archivePath,
          path.join(newFolder, path.basename(archivePath)),
        );
        return newFolder;
      }
    };
    const unzippedPath = await getUnzippedPath();

    if (!(await extExists(unzippedPath, scriptExtRegex))) {
      log.error('No script files are included.');
      return 'noScript';
    }
    if (await extExists(unzippedPath, pluginExtRegex)) {
      log.error('Plugin files are included.');
      return 'containsPlugin';
    }

    // Copying files
    const denyList = [
      '*readme*',
      '*copyright*',
      '*.txt',
      '*.zip',
      '*.aup',
      '*.md',
      'doc',
      'old',
      'old_*',
    ];
    const scriptRoot = (await searchScriptRoot(unzippedPath))[0];
    const entriesToCopy = (
      await fsReaddir(scriptRoot, {
        withFileTypes: true,
      })
    )
      .filter((p) => !isMatch([p.name], denyList))
      .map((p) => {
        return {
          src: path.join(scriptRoot, p.name),
          dest: path.join(instPath, 'script', matchInfo.folder, p.name),
          filename: path
            .join('script', matchInfo.folder, p.name)
            .replaceAll('\\', '/'),
          isDirectory: p.isDirectory(),
        };
      });
    await mkdir(path.join(instPath, 'script', matchInfo.folder), {
      recursive: true,
    });
    await Promise.all(
      entriesToCopy.map((filePath) => copy(filePath.src, filePath.dest)),
    );

    // Constructing package information
    const files = entriesToCopy.map((i) => {
      return { filename: i.filename, isDirectory: i.isDirectory };
    });

    const filteredFiles = files.filter((f) => scriptExtRegex.test(f.filename));
    const name = path.basename(
      filteredFiles[0].filename,
      path.extname(filteredFiles[0].filename),
    );
    const id = 'script_' + getHash(name);

    // Rename the extracted folder
    const newPath = path.join(path.dirname(unzippedPath), id);
    if (existsSync(newPath)) await rm(newPath, { recursive: true });
    await rename(unzippedPath, newPath);

    // Save package information
    const packageItem = {
      id: id,
      name: name,
      overview: 'スクリプト',
      description:
        'スクリプト一覧: ' +
        filteredFiles.map((f) => path.basename(f.filename)).join(', '),
      developer: matchInfo?.developer ?? '-',
      dependencies: matchInfo?.dependencies,
      pageURL: url,
      downloadURLs: [url] as [string, ...string[]],
      latestVersion: getDate(),
      files: files,
    };

    // 旧 parseJson.addPackage と同一の挙動(既存一覧の ID 変換込み)
    const localPackagesPath = path.join(instPath, 'packages.json');
    const localPackages: Packages['packages'] = existsSync(localPackagesPath)
      ? ((await readJson(localPackagesPath)) as Packages).packages
      : [];
    const convDict = await getIdDict(win, config);
    for (const localPackage of localPackages) {
      // For compatibility with data v1
      if (Object.prototype.hasOwnProperty.call(convDict, localPackage.id)) {
        localPackage.id = convDict[localPackage.id];
      }
    }
    const newLocalPackages = localPackages.filter((p) => p.id !== id);
    newLocalPackages.push(packageItem as Packages['packages'][number]);
    await writeJson(localPackagesPath, {
      version: 3,
      packages: newLocalPackages,
    });

    const apmJson = await ApmJson.load(instPath);
    await apmJson.addPackage(packageItem.id, packageItem.latestVersion);
    return 'success';
  } catch (e) {
    log.error(e);
    return 'installFailed';
  }
}

/**
 * Builds the share string of the installed packages for the clipboard.
 * 旧 src/renderer/main/package.ts の sharePackages の文字列生成部分と同一の
 * 挙動(クリップボードへの書き込みとボタン表示は renderer 側の責務)。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @returns {Promise<string>} The share string.
 */
export async function buildShareString(
  win: BrowserWindow,
  config: Config,
  instPath: string,
) {
  const ver = {
    share: shareStringVersion, // version of this data
    apm: app.getVersion(),
    aviutl: '',
    exedit: '',
    packages: [''],
  };

  const apmJson = await ApmJson.load(instPath);

  for (const program of programs) {
    const currentVersion = (await apmJson.get('core.' + program)) as string;
    ver[program] = currentVersion;
  }
  ver.packages = (await getPackagesExtra(win, config, instPath)).packages
    .filter(
      (p) =>
        p.installationStatus === states.installed ||
        p.installationStatus === states.manuallyInstalled,
    )
    .map((p) => p.id)
    .filter((id) => id.includes('/'))
    .sort((a, b) => {
      const compare = (a: string, b: string) => (a > b ? 1 : a < b ? -1 : 0);
      const a2 = a.split('/');
      const b2 = b.split('/');
      return a2[0] === b2[0] ? compare(a2[1], b2[1]) : compare(a2[0], b2[0]);
    });

  //  Variation Selectors: 🍎️(color), 🎞︎(text), 🎬︎(text)
  return `ここにタイトルを入力🍎️${ver.share}:${ver.apm},🎞︎${ver.aviutl},🎬︎${
    ver.exedit
  },${ver.packages.join(',')}`;
}

export type InstallScriptFlowResult =
  | { route: 'flow'; status: 'canceled' | 'notSupported' | 'redirectNotFound' }
  | { route: 'script'; status: InstallScriptResult }
  | { route: 'redirect'; status: InstallPackageResult };

/**
 * Opens the script distribution site in the browser, resolves the matched
 * script (or its redirect package) from the download history, and installs it.
 * 旧 src/renderer/main/package.ts の installScript 前半(ブラウザ DL →
 * matchInfo 解決 → redirect 分岐)と同一の挙動。UI は renderer 側に残る。
 * @param {BrowserWindow} win - A browser window used for downloads and dialogs.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @param {string} url - The URL of the script distribution site.
 * @returns {Promise<InstallScriptFlowResult>} The result status with its route.
 */
export async function installScriptFlow(
  win: BrowserWindow,
  config: Config,
  instPath: string,
  url: string,
): Promise<InstallScriptFlowResult> {
  const downloadResult = await openBrowser(win, url, 'package');
  if (!downloadResult) {
    log.info('The installation was canceled.');
    return { route: 'flow', status: 'canceled' };
  }

  const archivePath = downloadResult.savePath;
  const history = downloadResult.history;
  const matchInfo = [...(await getScriptsList(win, config, false)).scripts]
    .reverse()
    .find((item) => isMatch(history, item.match));

  if (!matchInfo) {
    log.error('The script is not supported.');
    return { route: 'flow', status: 'notSupported' };
  }

  if ('redirect' in matchInfo) {
    // Determine which of the redirections can be installed and install them.
    const packages = (await getPackagesWithStatus(win, config, instPath, false))
      .packages;
    const packageId = matchInfo.redirect
      .split('|')
      .find((candidate: string) =>
        packages.find((p) => p.id === candidate && p.doNotInstall !== true),
      );
    if (!packageId) {
      return { route: 'flow', status: 'redirectNotFound' };
    }
    const packageToInstall = packages.find((p) => p.id === packageId);
    return {
      route: 'redirect',
      status: await installPackageFlow(
        win,
        config,
        instPath,
        packageToInstall,
        {
          archivePath,
        },
      ),
    };
  }

  return {
    route: 'script',
    status: await installScriptArchive(
      win,
      config,
      instPath,
      archivePath,
      url,
      {
        folder: matchInfo.folder,
        developer: matchInfo.developer,
        dependencies: matchInfo.dependencies,
      },
    ),
  };
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
 * Returns the packages of the data editor (editorPackages.json).
 * 旧 src/lib/parseJson.ts の getPackages に src/lib/modList.ts の
 * getEditorPackagesDataUrl を合成したものと同一の挙動
 * (ファイルが無いときに例外を投げる点も含めて維持)。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @returns {Promise<Packages['packages']>} A list of packages.
 */
export async function getEditorPackages(
  win: BrowserWindow,
  config: Config,
  instPath: string,
): Promise<Packages['packages']> {
  const packagesListPath = path.join(instPath, 'editorPackages.json');
  if (!existsSync(packagesListPath))
    throw new Error('The version file does not exist.');

  const packages = ((await readJson(packagesListPath)) as Packages).packages;
  const convDict = await getIdDict(win, config);
  for (const packageItem of packages) {
    // For compatibility with data v1
    if (Object.prototype.hasOwnProperty.call(convDict, packageItem.id)) {
      packageItem.id = convDict[packageItem.id];
    }
  }
  return packages;
}

/**
 * Writes the packages of the data editor (editorPackages.json).
 * 旧 src/lib/parseJson.ts の setPackages と同一の挙動。
 * @param {string} instPath - An installation path.
 * @param {Packages['packages']} packages - A list of packages.
 */
export async function setEditorPackages(
  instPath: string,
  packages: Packages['packages'],
) {
  await writeJson(path.join(instPath, 'editorPackages.json'), {
    version: 3,
    packages: packages,
  });
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
 * Opens the download folder of the package, and returns whether it exists.
 * 旧 OPEN_PATH ハンドラに renderer が `package/${id}` を渡していた処理と
 * 同一の挙動(データフォルダ外の拒否も維持)。
 * @param {string} packageId - The id of the package.
 * @returns {Promise<boolean>} Whether the folder exists.
 */
export async function openPackageFolder(packageId: string): Promise<boolean> {
  const dataDir = path.join(app.getPath('userData'), 'Data/');
  const folderPath = path.join(dataDir, 'package', packageId);
  // packageId はリモート由来のため、データフォルダ外は拒否する
  if (!isParent(dataDir, folderPath)) {
    log.error(`Refused to open a path outside the data folder: ${packageId}`);
    return false;
  }
  const folderExists = existsSync(folderPath);
  if (folderExists) await shell.openPath(folderPath);
  return folderExists;
}
