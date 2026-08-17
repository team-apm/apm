import type { Packages, Scripts } from 'apm-schema';
import { type BrowserWindow, dialog } from 'electron';
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
import ApmJson from '../../lib/ApmJson';
import type Config from '../../lib/Config';
import { getHash } from '../../shared/getHash';
import { install, verifyFilesByCount } from '../../shared/install';
import { checkIntegrity } from '../../shared/integrity';
import {
  computePackagesStatus,
  detectPackageTypes,
  getInstalledVersionOfPackage,
  getManuallyInstalledFiles,
  states,
} from '../../shared/packageUtil';
import { safeRemove } from '../../shared/safeRemove';
import unzip from '../../shared/unzip';
import { ApmJsonObject } from '../../types/apmJson';
import { PackageItem } from '../../types/packageItem';
import { downloadFile } from './download';
import { getConvertDataUrl, getInfo, getScriptsDataUrl } from './modList';
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

export type UninstallPackageResult = 'success' | 'removeFailed' | 'filesRemain';

/**
 * Removes the files of the package and removes it from apm.json.
 * 旧 src/renderer/main/package.ts の uninstallPackage の計算部分と同一の挙動
 * (削除失敗時のメッセージ表示・スクリプト用の後処理は renderer 側の責務)。
 * @param {string} instPath - An installation path.
 * @param {object} packageItem - A package to uninstall.
 * @returns {Promise<UninstallPackageResult>} The result of the uninstallation.
 */
export async function uninstallPackageFiles(
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
  return filesCount === notExistCount ? 'success' : 'filesRemain';
}

// To avoid a bug in the library
// https://github.com/sindresorhus/matcher/issues/32
const isMatch = (
  input: string | readonly string[],
  pattern: readonly string[],
) => pattern.some((p) => matcher.isMatch(input, p));

export type InstallScriptResult =
  | 'success'
  | 'noScript'
  | 'containsPlugin'
  | 'installFailed';

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
