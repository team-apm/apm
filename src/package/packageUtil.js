const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const parseXML = require('../lib/parseXML');
const apmJson = require('../lib/apmJson');

/** Installation state of packages */
const states = {
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
      default:
        result.push('不明');
        break;
    }
  }
  return result;
}

/**
 * Returns an object parsed from packages.xml
 *
 * @param {string[]} packageDataUrls - URLs of the repository
 * @returns {Promise<object[]>} - A list of object parsed from packages.xml
 */
async function getPackages(packageDataUrls) {
  const xmlList = {};

  for (const packageRepository of packageDataUrls) {
    const packagesListFile = await ipcRenderer.invoke(
      'exists-temp-file',
      `package/${path.basename(packageRepository)}`,
      packageRepository
    );
    if (packagesListFile.exists) {
      try {
        xmlList[packageRepository] = await parseXML.getPackages(
          packagesListFile.path
        );
      } catch {
        ipcRenderer.invoke(
          'open-err-dialog',
          'データ解析エラー',
          '取得したデータの処理に失敗しました。' +
            '\n' +
            'URL: ' +
            packageRepository
        );
      }
    }
  }

  const packages = [];
  for (const [packagesRepository, packagesInfo] of Object.entries(xmlList)) {
    for (const [id, packageInfo] of Object.entries(packagesInfo)) {
      packages.push({
        repository: packagesRepository,
        id: id,
        info: packageInfo,
      });
    }
  }
  return packages;
}

/**
 * @param {string[]} packageDataUrls - URLs of the repository
 */
async function downloadRepository(packageDataUrls) {
  for (const packageRepository of packageDataUrls) {
    await ipcRenderer.invoke(
      'download',
      packageRepository,
      false,
      'package',
      packageRepository
    );
  }
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
      else throw e;
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
 * @param {object[]} packages - A list of object parsed from packages.xml
 * @returns {string[]} List of manually installed files
 */
function getManuallyInstalledFiles(files, installedPackages, packages) {
  let retFiles = [...files];
  for (const package of packages) {
    for (const [installedId, installedPackage] of Object.entries(
      installedPackages
    )) {
      if (
        installedId === package.id &&
        installedPackage.repository === package.repository
      ) {
        for (const file of package.info.files) {
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
 * @param {object} package - A Package
 * @param {string[]} installedFiles - List of installed files
 * @param {string[]} manuallyInstalledFiles - List of manually installed files
 * @param {object[]} installedPackages - A list of object from apmJson
 * @param {string} instPath - An installation path
 * @returns {string} Installed version or installation status of the package
 */
function getInstalledVersionOfPackage(
  package,
  installedFiles,
  manuallyInstalledFiles,
  installedPackages,
  instPath
) {
  let installedVersion;
  let addedVersion = false;
  let manuallyAddedVersion = false;
  for (const file of package.info.files) {
    if (!file.isOptional) {
      if (installedFiles.includes(file.filename)) addedVersion = true;
      if (manuallyInstalledFiles.includes(file.filename))
        manuallyAddedVersion = true;
    }
  }
  installedVersion = manuallyAddedVersion
    ? states.manuallyInstalled
    : addedVersion
    ? states.otherInstalled
    : states.notInstalled;

  for (const [installedId, installedPackage] of Object.entries(
    installedPackages
  )) {
    if (
      installedId === package.id &&
      installedPackage.repository === package.repository
    ) {
      let filesCount = 0;
      let existCount = 0;
      for (const file of package.info.files) {
        if (!file.isOptional) {
          filesCount++;
          if (fs.existsSync(path.join(instPath, file.filename))) {
            existCount++;
          }
        }
      }

      if (filesCount === existCount) {
        installedVersion = 'インストール済み: ' + installedPackage.version;
      } else {
        installedVersion = states.installedButBroken;
      }
    }
  }

  return installedVersion;
}

/**
 * Updates the installedVersion of the packages given as argument and returns a list of manually installed files
 *
 * @param {object[]} packages - A list of object parsed from packages.xml
 * @param {string} instPath - An installation path
 * @returns {string[]} List of manually installed files
 */
function getPackgesExtra(packages, instPath) {
  const tmpInstalledPackages = apmJson.get(instPath, 'packages');
  const tmpInstalledFiles = getInstalledFiles(instPath);
  const tmpManuallyInstalledFiles = getManuallyInstalledFiles(
    tmpInstalledFiles,
    tmpInstalledPackages,
    packages
  );
  packages.forEach((p) => {
    p.installedVersion = getInstalledVersionOfPackage(
      p,
      tmpInstalledFiles,
      tmpManuallyInstalledFiles,
      tmpInstalledPackages,
      instPath
    );
  });
  return tmpManuallyInstalledFiles;
}

module.exports = {
  states,
  parsePackageType,
  getPackages,
  downloadRepository,
  getPackgesExtra,
};
