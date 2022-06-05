import log from 'electron-log';
import fs from 'fs-extra';
import path from 'path';
import apmJson from '../../lib/apmJson';
import { download, existsTempFile, openDialog } from '../../lib/ipcWrapper';
import parseJson from '../../lib/parseJson';
import { verifyFilesByCount } from './common';
/** @typedef {import("apm-data").Packages} Packages */

const typeForExtention = {
  '.auf': 'filter',
  '.aui': 'input',
  '.auo': 'output',
  '.auc': 'color',
  '.aul': 'language',
  '.anm': 'animation',
  '.obj': 'object',
  '.cam': 'camera',
  '.tra': 'track',
  '.scn': 'scene',
};

/** Installation state of packages */
const states = {
  installed: 'インストール済み',
  installedButBroken:
    '未インストール（ファイルの存在が確認できませんでした。）',
  manuallyInstalled: '手動インストール済み',
  otherInstalled: '他バージョンがインストール済み',
  notInstalled: '未インストール',
};

/**
 * Convert type from internal expression to display
 *
 * @param {string[]} packageType - A list of package types
 * @returns {string[]} Parsed package types
 */
function parsePackageType(packageType) {
  const result = [];
  for (const type of packageType) {
    switch (type) {
      // plugin
      case 'input':
        result.push('入力');
        break;
      case 'output':
        result.push('出力');
        break;
      case 'filter':
        result.push('フィルター');
        break;
      case 'color':
        result.push('色変換');
        break;
      case 'language':
        result.push('言語');
        break;
      // script
      case 'animation':
        result.push('アニメーション効果');
        break;
      case 'object':
        result.push('カスタムオブジェクト');
        break;
      case 'scene':
        result.push('シーンチェンジ');
        break;
      case 'camera':
        result.push('カメラ制御');
        break;
      case 'track':
        result.push('トラックバー');
        break;
      // script distribution sites
      case 'script-dist':
        result.push('スクリプト配布サイト');
        break;
      default:
        result.push('不明');
        break;
    }
  }
  return result;
}

/**
 * Returns an object parsed from packages.json
 *
 * @param {string[]} packageDataUrls - URLs of the repository
 * @returns {Promise<object[]>} - A list of object parsed from packages.json
 */
async function getPackages(packageDataUrls) {
  const jsonList = [];

  for (const packageRepository of packageDataUrls) {
    const packagesListFile = await existsTempFile(
      `package/${path.basename(packageRepository)}`,
      packageRepository
    );
    if (packagesListFile.exists) {
      try {
        jsonList.push(await parseJson.getPackages(packagesListFile.path));
      } catch {
        log.error('Failed data processing.');
        openDialog(
          'データ解析エラー',
          '取得したデータの処理に失敗しました。' +
            '\n' +
            'URL: ' +
            packageRepository,
          'error'
        );
      }
    }
  }

  const packages = [];
  for (const packagesInfo of jsonList) {
    for (const packageInfo of packagesInfo) {
      // Detect package type
      const types = packageInfo.files.flatMap((f) => {
        const extention = path.extname(f.filename);
        if (extention in typeForExtention) {
          return [typeForExtention[extention]];
        } else {
          return [];
        }
      });

      packages.push({
        id: packageInfo.id,
        info: packageInfo,
        type: Array.from(new Set(types)),
      });
    }
  }
  return packages;
}

/**
 * @param {string[]} packageDataUrls - URLs of the repository
 */
async function downloadRepository(packageDataUrls) {
  await Promise.all(
    packageDataUrls.map((packageRepository) =>
      download(packageRepository, {
        subDir: 'package',
        keyText: packageRepository,
      })
    )
  );
}

/**
 * Returns a list of installed files.
 *
 * @param {string} instPath - An installation path
 * @returns {string[]} List of installed files
 */
function getInstalledFiles(instPath) {
  const regex = /^(?!exedit).*\.(auf|aui|auo|auc|aul|anm|obj|cam|tra|scn)$/;
  const safeReaddirSync = (path, option) => {
    try {
      return fs.readdirSync(path, option);
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      log.error(e);
      throw e;
    }
  };
  const readdir = (dir) =>
    safeReaddirSync(dir, { withFileTypes: true })
      .filter((i) => i.isFile() && regex.test(i.name))
      .map((i) => i.name);
  return readdir(instPath).concat(
    readdir(path.join(instPath, 'plugins')).map((i) => 'plugins/' + i),
    readdir(path.join(instPath, 'script')).map((i) => 'script/' + i),
    safeReaddirSync(path.join(instPath, 'script'), { withFileTypes: true })
      .filter((i) => i.isDirectory())
      .map((i) => 'script/' + i.name)
      .flatMap((i) => readdir(path.join(instPath, i)).map((j) => i + '/' + j))
  );
}

/**
 * Returns a list of files that were manually installed.
 *
 * @param {string[]} files - List of installed files
 * @param {object[]} installedPackages - A list of object from apmJson
 * @param {object[]} packages - A list of object parsed from packages.json
 * @returns {string[]} List of manually installed files
 */
function getManuallyInstalledFiles(files, installedPackages, packages) {
  let retFiles = [...files];
  for (const packageItem of packages) {
    for (const installedId of Object.keys(installedPackages)) {
      if (installedId === packageItem.id) {
        for (const file of packageItem.info.files) {
          if (!file.isDirectory) {
            retFiles = retFiles.filter((ef) => ef !== file.filename);
          } else {
            retFiles = retFiles.filter((ef) => !ef.startsWith(file.filename));
          }
        }
      }
    }
  }
  return retFiles;
}

/**
 * Returns the installed version or installation status of the package.
 *
 * @param {object} packageItem - A Package
 * @param {string[]} installedFiles - List of installed files
 * @param {string[]} manuallyInstalledFiles - List of manually installed files
 * @param {object[]} installedPackages - A list of object from apmJson
 * @param {string} instPath - An installation path
 * @returns {object} Installed version or installation status of the package
 */
function getInstalledVersionOfPackage(
  packageItem,
  installedFiles,
  manuallyInstalledFiles,
  installedPackages,
  instPath
) {
  let installationStatus;
  let version;
  let isInstalledPackage = false;
  let isManuallyInstalledPackage = false;
  for (const file of packageItem.info.files) {
    if (installedFiles.includes(file.filename)) isInstalledPackage = true;
    if (manuallyInstalledFiles.includes(file.filename))
      isManuallyInstalledPackage = true;
  }
  installationStatus = isManuallyInstalledPackage
    ? states.manuallyInstalled
    : isInstalledPackage
    ? states.otherInstalled
    : states.notInstalled;

  for (const [installedId, installedPackage] of Object.entries(
    installedPackages
  )) {
    if (installedId === packageItem.id) {
      if (packageItem.info.files.some((file) => file.isObsolete)) {
        // There is no way to determine if a package that contains obsolete files is corrupt.
        installationStatus = states.installed;
        version = installedPackage.version;
      } else {
        // Determine if the package has been installed properly.
        if (verifyFilesByCount(instPath, packageItem.info.files)) {
          installationStatus = states.installed;
          version = installedPackage.version;
        } else {
          installationStatus = states.installedButBroken;
        }
      }
    }
  }

  return [installationStatus, version];
}

/**
 * Updates the installedVersion of the packages given as argument and returns a list of manually installed files
 *
 * @param {object[]} _packages - A list of object parsed from packages.json
 * @param {string} instPath - An installation path
 * @returns {object} List of manually installed files
 */
function getPackagesExtra(_packages, instPath) {
  const packages = [..._packages].map((p) => {
    return { ...p };
  });
  const tmpInstalledPackages = apmJson.get(instPath, 'packages');
  const tmpInstalledFiles = getInstalledFiles(instPath);
  const tmpManuallyInstalledFiles = getManuallyInstalledFiles(
    tmpInstalledFiles,
    tmpInstalledPackages,
    packages
  );
  packages.forEach((p) => {
    [p.installationStatus, p.version] = getInstalledVersionOfPackage(
      p,
      tmpInstalledFiles,
      tmpManuallyInstalledFiles,
      tmpInstalledPackages,
      instPath
    );
  });
  return {
    manuallyInstalledFiles: tmpManuallyInstalledFiles,
    packages: packages,
  };
}

/**
 * Updates the installedVersion of the packages given as argument and returns a list of manually installed files
 *
 * @param {string} instPath - An installation path
 * @param {object[]} _packages - A list of object parsed from packages.json and getPackagesExtra()
 * @returns {object[]} - packages
 */
function getPackagesStatus(instPath, _packages) {
  const packages = [..._packages].map((p) => {
    return { ...p };
  });
  let aviUtlVer = '';
  let exeditVer = '';
  const aviUtlR = /aviutl\d/;
  const exeditR = /exedit\d/;
  try {
    aviUtlVer = apmJson.get(instPath, 'core.' + 'aviutl', '');
    exeditVer = apmJson.get(instPath, 'core.' + 'exedit', '');
  } catch (e) {
    log.info(e);
  }
  packages.forEach((p) => {
    const doNotInstall = (p) => {
      if (p.installationStatus === states.otherInstalled) {
        return true;
      }
      if (p.info.dependencies) {
        // Whether there is at least one package that is not installable
        return p.info.dependencies
          .map((ids) => {
            // Whether all ids are not installable
            return ids
              .split('|')
              .map((id) => {
                if (aviUtlR.test(id)) {
                  return id !== 'aviutl' + aviUtlVer;
                }
                if (exeditR.test(id)) {
                  return id !== 'exedit' + exeditVer;
                }
                // Actually, there is no need to use a list because id is unique
                return packages
                  .filter((pp) => pp.id === id)
                  .map((pp) => doNotInstall(pp))
                  .some((e) => e);
              })
              .every((e) => e);
          })
          .some((e) => e);
      }
      return false;
    };
    p.doNotInstall = doNotInstall(p);
  });
  packages.forEach((p) => {
    const isInstalled = (p) =>
      p.installationStatus !== states.installedButBroken &&
      p.installationStatus !== states.notInstalled &&
      p.installationStatus !== states.otherInstalled;
    const detached = (p) => {
      const lists = [];
      if (!isInstalled(p)) lists.push(p);
      if (p.info.dependencies) {
        lists.push(
          ...p.info.dependencies.flatMap((ids) => {
            // Whether all ids are detached or not
            const isDetached = ids
              .split('|')
              .map((id) => {
                if (aviUtlR.test(id) || exeditR.test(id)) return false;
                // Actually, there is no need to use a list because id is unique
                return packages
                  .filter((pp) => pp.id === id)
                  .map((pp) => detached(pp).length !== 0)
                  .some((e) => e);
              })
              .every((e) => e);

            if (!isDetached) return [];

            // If all id's are detached, perform a list fetch for the ids
            for (const id of ids.split('|')) {
              if (aviUtlR.test(id) || exeditR.test(id)) {
                continue;
              }
              const ps = packages
                .filter((pp) => pp.id === id)
                .flatMap((pp) => detached(pp).filter((p) => !p.doNotInstall));
              if (ps.length > 0) return ps;
            }
            return [];
          })
        );
      }
      return lists;
    };
    p.detached = isInstalled(p) ? detached(p) : [];
  });
  return packages;
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
