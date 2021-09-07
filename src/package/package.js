const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const List = require('list.js');
const replaceText = require('../lib/replaceText');
const unzip = require('../lib/unzip');
const setting = require('../setting/setting');
const buttonTransition = require('../lib/buttonTransition');
const parseXML = require('../lib/parseXML');
const apmJson = require('../lib/apmJson');

let selectedPackage;
let listJS;

/**
 * @param {string} packageType - A list of package types.
 * @returns {string} Parsed package types.
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
  return result.toString();
}

/**
 * Show package's details.
 *
 * @param {object} packageData - An object of package's details.
 */
function showPackageDetail(packageData) {
  for (const detail of ['name', 'overview', 'description', 'developer']) {
    replaceText('package-' + detail, packageData.info[detail]);
  }
  replaceText('package-type', parsePackageType(packageData.info.type));
  replaceText('package-latest-version', packageData.info.latestVersion);

  const a = document.createElement('a');
  a.innerText = packageData.info.pageURL;
  a.href = packageData.info.pageURL;
  const pageSpan = document.getElementById('package-page');
  while (pageSpan.firstChild) {
    pageSpan.removeChild(pageSpan.firstChild);
  }
  pageSpan.appendChild(a);
}

module.exports = {
  /**
   * Initializes package
   *
   * @param {string} instPath - An installation path
   */
  initPackage: function (instPath) {
    if (!apmJson.has(instPath, 'packages'))
      apmJson.set(instPath, 'packages', {});
  },

  /**
   * Returns an object parsed from packages_list.xml.
   *
   * @returns {Promise<object>} - A list of object parsed from packages_list.xml.
   */
  getPackagesInfo: async function () {
    const xmlList = {};

    for (const packageRepo of setting.getPackagesDataUrl()) {
      const packagesListFile = await ipcRenderer.invoke(
        'exists-temp-file',
        'package/packages_list.xml',
        packageRepo
      );
      if (packagesListFile.exists) {
        try {
          xmlList[packageRepo] = parseXML.package(packagesListFile.path);
        } catch {
          ipcRenderer.invoke(
            'open-err-dialog',
            'データ解析エラー',
            '取得したデータの処理に失敗しました。' +
              '\n' +
              'URL: ' +
              packageRepo
          );
        }
      }
    }
    return xmlList;
  },

  /**
   * Sets rows of each package in the table.
   *
   * @param {string} instPath - An installation path.
   */
  setPackagesList: async function (instPath) {
    const packagesTable = document.getElementById('packages-table');
    const thead = packagesTable.getElementsByTagName('thead')[0];
    const tbody = packagesTable.getElementsByTagName('tbody')[0];
    tbody.innerHTML = null;
    const bottomTbody = packagesTable.getElementsByTagName('tbody')[1];
    bottomTbody.innerHTML = null;

    const columns = [
      'name',
      'overview',
      'developer',
      'type',
      'latestVersion',
      'installedVersion',
    ];
    const columnsDisp = [
      '名前',
      '概要',
      '開発者',
      'タイプ',
      '最新バージョン',
      '現在バージョン',
    ];

    // table header
    if (!thead.hasChildNodes()) {
      const headerTr = document.createElement('tr');
      for (const [i, columnName] of columns.entries()) {
        const th = document.createElement('th');
        th.classList.add('sort');
        th.setAttribute('data-sort', columnName);
        th.setAttribute('scope', 'col');
        th.innerText = columnsDisp[i];
        headerTr.appendChild(th);
      }
      thead.appendChild(headerTr);
    }

    // table body
    const packages = [];
    for (const [packagesRepo, packagesInfo] of Object.entries(
      await this.getPackagesInfo()
    )) {
      for (const [id, packageInfo] of Object.entries(packagesInfo)) {
        packages.push({ repo: packagesRepo, id: id, info: packageInfo });
      }
    }

    const installedPackages = apmJson.get(instPath, 'packages');

    const getExistingFiles = () => {
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
          .flatMap((i) =>
            readdir(path.join(instPath, i)).map((j) => i + '/' + j)
          )
      );
    };
    const existingFiles = getExistingFiles();

    let manualFiles = [...existingFiles];
    for (const package of packages) {
      for (const [installedId, installedPackage] of Object.entries(
        installedPackages
      )) {
        if (
          installedId === package.id &&
          installedPackage.repository === package.repo
        ) {
          for (const file of package.info.files) {
            if (!file.isOptional) {
              if (manualFiles.includes(file.filename)) {
                manualFiles = manualFiles.filter((ef) => ef !== file.filename);
              }
            }
            if (!file.isOptional && file.isDirectory) {
              manualFiles = manualFiles.filter(
                (ef) => !ef.startsWith(file.filename)
              );
            }
          }
        }
      }
    }

    const makeTrFromArray = (tdList) => {
      const tr = document.createElement('tr');
      const tds = tdList.map((tdName) => {
        const td = document.createElement('td');
        td.classList.add(tdName);
        tr.appendChild(td);
        return td;
      });
      return [tr].concat(tds);
    };

    for (const package of packages) {
      const [
        tr,
        name,
        overview,
        developer,
        type,
        latestVersion,
        installedVersion,
      ] = makeTrFromArray(columns);
      tr.classList.add('package-tr');
      tr.addEventListener('click', (event) => {
        showPackageDetail(package);
        selectedPackage = package;
        for (const tmptr of tbody.getElementsByTagName('tr')) {
          tmptr.classList.remove('table-secondary');
        }
        tr.classList.add('table-secondary');
      });
      name.innerHTML = package.info.name;
      overview.innerHTML = package.info.overview;
      developer.innerHTML = package.info.developer;
      type.innerHTML = parsePackageType(package.info.type);
      latestVersion.innerHTML = package.info.latestVersion;

      let otherVersion = false;
      let otherManualVersion = false;
      for (const file of package.info.files) {
        if (!file.isOptional) {
          if (existingFiles.includes(file.filename)) otherVersion = true;
          if (manualFiles.includes(file.filename)) otherManualVersion = true;
        }
      }
      installedVersion.innerHTML = otherManualVersion
        ? '手動インストール済み'
        : otherVersion
        ? '他バージョンがインストール済み'
        : '未インストール';

      for (const [installedId, installedPackage] of Object.entries(
        installedPackages
      )) {
        if (
          installedId === package.id &&
          installedPackage.repository === package.repo
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
            installedVersion.innerHTML = installedPackage.version;
          } else {
            installedVersion.innerHTML =
              '未インストール（ファイルの存在が確認できませんでした。）';
          }
        }
      }

      tbody.appendChild(tr);
    }

    // list manually added packages
    for (const ef of manualFiles) {
      const [
        tr,
        name,
        overview,
        developer,
        type,
        latestVersion,
        installedVersion,
      ] = makeTrFromArray(columns);
      tr.classList.add('package-tr');
      name.innerHTML = ef;
      overview.innerHTML = '手動で追加されたファイル';
      developer.innerHTML = '';
      type.innerHTML = '';
      latestVersion.innerHTML = '';
      installedVersion.innerHTML = '';
      bottomTbody.appendChild(tr);
    }

    // sorting and filtering
    if (typeof listJS === 'undefined') {
      listJS = new List('packages', { valueNames: columns });
    } else {
      listJS.reIndex();
    }
  },

  /**
   * Checks the packages list.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of button element.
   * @param {HTMLDivElement} overlay - A overlay of packages list.
   * @param {string} instPath - An installation path.
   */
  checkPackagesList: async function (btn, overlay, instPath) {
    const enableButton = buttonTransition.loading(btn);

    overlay.style.zIndex = 1000;
    overlay.classList.add('show');

    try {
      for (const packageRepo of setting.getPackagesDataUrl()) {
        await ipcRenderer.invoke(
          'download',
          packageRepo,
          true,
          'package',
          packageRepo
        );
      }
      await this.setPackagesList(instPath);

      buttonTransition.message(btn, '更新完了', 'success');
    } catch {
      buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
    }

    overlay.classList.remove('show');
    overlay.style.zIndex = -1;

    setTimeout(() => {
      enableButton();
    }, 3000);
  },

  /**
   * Installs a package to installation path.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
   * @param {string} instPath - An installation path.
   */
  installPackage: async function (btn, instPath) {
    const enableButton = buttonTransition.loading(btn);

    if (!instPath) {
      buttonTransition.message(
        btn,
        'インストール先フォルダを指定してください。',
        'danger'
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
      throw new Error('An installation path is not selected.');
    }

    if (!selectedPackage) {
      buttonTransition.message(
        btn,
        'プラグインまたはスクリプトを選択してください。',
        'danger'
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
      throw new Error('A package to install is not selected.');
    }

    const url = selectedPackage.info.downloadURL;
    const archivePath = await ipcRenderer.invoke(
      'open-browser',
      url,
      'package'
    );
    if (archivePath === 'close') {
      buttonTransition.message(
        btn,
        'インストールがキャンセルされました。',
        'info'
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
      return;
    }

    try {
      const unzippedPath = await unzip(archivePath);

      if (selectedPackage.info.installer) {
        const searchFiles = (dirName) => {
          let result = [];
          const dirents = fs.readdirSync(dirName, {
            withFileTypes: true,
          });
          for (const dirent of dirents) {
            if (dirent.isDirectory()) {
              const childResult = searchFiles(path.join(dirName, dirent.name));
              result = result.concat(childResult);
            } else {
              if (dirent.name === selectedPackage.info.installer) {
                result.push([path.join(dirName, dirent.name)]);
                break;
              }
            }
          }
          return result;
        };

        const exePath = searchFiles(unzippedPath);
        const command =
          '"' +
          exePath[0][0] +
          '" ' +
          selectedPackage.info.installArg
            .replace('"$instpath"', '$instpath')
            .replace('$instpath', '"' + instPath + '"'); // Prevent double quoting
        execSync(command);
      } else {
        const filesToCopy = [];
        for (const file of selectedPackage.info.files) {
          if (!file.isOptional) {
            if (file.archivePath === null) {
              filesToCopy.push([
                path.join(unzippedPath, path.basename(file.filename)),
                path.join(instPath, file.filename),
              ]);
            } else {
              filesToCopy.push([
                path.join(
                  unzippedPath,
                  file.archivePath,
                  path.basename(file.filename)
                ),
                path.join(instPath, file.filename),
              ]);
            }
          }
        }
        for (const filePath of filesToCopy) {
          fs.copySync(filePath[0], filePath[1]);
        }
      }
    } catch (e) {
      buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
      setTimeout(() => {
        enableButton();
      }, 3000);
      throw e;
    }

    let filesCount = 0;
    let existCount = 0;
    for (const file of selectedPackage.info.files) {
      if (!file.isOptional) {
        filesCount++;
        if (fs.existsSync(path.join(instPath, file.filename))) {
          existCount++;
        }
      }
    }

    if (filesCount === existCount) {
      apmJson.addPackage(instPath, selectedPackage);
      await this.setPackagesList(instPath);

      buttonTransition.message(btn, 'インストール完了', 'success');
    } else {
      buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
    }

    setTimeout(() => {
      enableButton();
    }, 3000);
  },

  /**
   * Uninstalls a package to installation path.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
   * @param {string} instPath - An installation path.
   */
  uninstallPackage: async function (btn, instPath) {
    const enableButton = buttonTransition.loading(btn);

    if (!instPath) {
      buttonTransition.message(
        btn,
        'インストール先フォルダを指定してください。',
        'danger'
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
      throw new Error('An installation path is not selected.');
    }

    if (!selectedPackage) {
      buttonTransition.message(
        btn,
        'プラグインまたはスクリプトを選択してください。',
        'danger'
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
      throw new Error('A package to install is not selected.');
    }

    for (const file of selectedPackage.info.files) {
      fs.removeSync(path.join(instPath, file.filename));
    }

    let filesCount = 0;
    let existCount = 0;
    for (const file of selectedPackage.info.files) {
      if (!file.isOptional) {
        filesCount++;
        if (!fs.existsSync(path.join(instPath, file.filename))) {
          existCount++;
        }
      }
    }

    if (filesCount === existCount) {
      apmJson.removePackage(instPath, selectedPackage);
      await this.setPackagesList(instPath);

      buttonTransition.message(btn, 'アンインストール完了', 'success');
    } else {
      buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
    }

    setTimeout(() => {
      enableButton();
    }, 3000);
  },
};
