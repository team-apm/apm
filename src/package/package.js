const { ipcRenderer } = require('electron');
const Store = require('electron-store');
const store = new Store();
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
const mod = require('../lib/mod');
const getHash = require('../lib/getHash');
const packageUtil = require('./packageUtil');

/**
 * Shows check date.
 */
function showCheckDate() {
  if (document.getElementById('packages-check-date')) {
    if (store.has('checkDate.packages')) {
      const checkDate = new Date(store.get('checkDate.packages'));
      replaceText('packages-check-date', checkDate.toLocaleString());
    } else {
      replaceText('packages-check-date', '未確認');
    }
  }
}

let selectedPackage;
let listJS;
// let installBtn;

/**
 * Show package's details.
 *
 * @param {object} packageData - An object of package's details.
 */
function showPackageDetail(packageData) {
  for (const detail of ['name', 'overview', 'description', 'developer']) {
    replaceText('package-' + detail, packageData.info[detail]);
  }
  replaceText(
    'package-type',
    packageUtil.parsePackageType(packageData.info.type)
  );
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

// Functions to be exported

/**
 * Initializes package
 *
 * @param {string} instPath - An installation path
 * @param {HTMLButtonElement} installPackageBtn - Button to install the package
 */
function initPackage(instPath, installPackageBtn) {
  if (!apmJson.has(instPath, 'packages')) apmJson.set(instPath, 'packages', {});
  // installBtn = installPackageBtn;
}

/**
 * Sets rows of each package in the table.
 *
 * @param {string} instPath - An installation path.
 * @param {boolean} minorUpdate - Only the version of the installed package is updated.
 */
async function setPackagesList(instPath, minorUpdate = false) {
  const packagesTable = document.getElementById('packages-table');
  const thead = packagesTable.getElementsByTagName('thead')[0];
  const tbody = packagesTable.getElementsByTagName('tbody')[0];
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
  const packages = await packageUtil.getPackages(
    setting.getPackagesDataUrl(instPath)
  );
  const installedPackages = apmJson.get(instPath, 'packages');
  const installedFiles = packageUtil.getInstalledFiles(instPath);
  const manuallyInstalledFiles = packageUtil.getManuallyInstalledFiles(
    installedFiles,
    installedPackages,
    packages
  );
  packages.forEach((p) => {
    p.installedVersion = packageUtil.getInstalledVersionOfPackage(
      p,
      installedFiles,
      manuallyInstalledFiles,
      installedPackages,
      instPath
    );
  });

  let aviUtlVer = '';
  let exeditVer = '';
  const aviUtlR = /aviutl\d/;
  const exeditR = /exedit\d/;
  try {
    aviUtlVer = apmJson.get(instPath, 'core.' + 'aviutl', '');
    exeditVer = apmJson.get(instPath, 'core.' + 'exedit', '');
    // eslint-disable-next-line no-empty
  } catch {}
  packages.forEach((p) => {
    const doNotInstall = (p) => {
      if (p.installedVersion === packageUtil.states.otherInstalled) {
        return true;
      }
      if (p.info.dependencies) {
        return p.info.dependencies.dependency
          .map((id) => {
            if (aviUtlR.test(id)) {
              return id !== 'aviutl' + aviUtlVer;
            }
            if (exeditR.test(id)) {
              return id !== 'exedit' + exeditVer;
            }
            return packages
              .filter((pp) => pp.id === id)
              .map((pp) => doNotInstall(pp))
              .some((e) => e);
          })
          .some((e) => e);
      }
      return false;
    };
    p.doNotInstall = doNotInstall(p);

    const isInstalled = (p) =>
      p.installedVersion !== packageUtil.states.installedButBroken &&
      p.installedVersion !== packageUtil.states.notInstalled &&
      p.installedVersion !== packageUtil.states.otherInstalled;
    const detached = (p) => {
      if (!isInstalled(p)) {
        return true;
      }
      if (p.info.dependencies) {
        return p.info.dependencies.dependency
          .map((id) => {
            if (aviUtlR.test(id) || exeditR.test(id)) {
              return false;
            }
            return packages
              .filter((pp) => pp.id === id)
              .map((pp) => detached(pp))
              .some((e) => e);
          })
          .some((e) => e);
      }
      return false;
    };
    p.detached = isInstalled(p) ? detached(p) : false;
  });

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

  if (!minorUpdate) {
    tbody.innerHTML = null;

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
      tr.dataset.id = package.id;
      tr.dataset.repository = package.repository;
      tr.addEventListener('click', (event) => {
        showPackageDetail(package);
        selectedPackage = package;
        for (const tmptr of tbody.getElementsByTagName('tr')) {
          tmptr.classList.remove('table-secondary');
        }
        tr.classList.add('table-secondary');
      });
      name.innerText = package.info.name;
      overview.innerText = package.info.overview;
      developer.innerText = package.info.developer;
      type.innerText = packageUtil.parsePackageType(package.info.type);
      latestVersion.innerText = package.info.latestVersion;
      installedVersion.innerText =
        (package.doNotInstall ? '⚠️インストール不可\r\n' : '') +
        (package.detached ? '❗ 依存関係をインストールしてください\r\n' : '') +
        package.installedVersion;

      tbody.appendChild(tr);
    }
  } else {
    for (const package of packages) {
      for (const tr of tbody.getElementsByTagName('tr')) {
        if (
          tr.dataset.id === package.id &&
          tr.dataset.repository === package.repository
        ) {
          const installedVersion =
            tr.getElementsByClassName('installedVersion')[0];
          installedVersion.innerText =
            (package.doNotInstall ? '⚠️インストール不可\r\n' : '') +
            (package.detached
              ? '❗ 依存関係をインストールしてください\r\n'
              : '') +
            package.installedVersion;
        }
      }
    }
  }

  // list manually added packages
  for (const ef of manuallyInstalledFiles) {
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
    name.innerText = ef;
    overview.innerText = '手動で追加されたファイル';
    developer.innerText = '';
    type.innerText = '';
    latestVersion.innerText = '';
    installedVersion.innerText = '';
    bottomTbody.appendChild(tr);
  }

  // sorting and filtering
  if (typeof listJS === 'undefined') {
    listJS = new List('packages', { valueNames: columns });
  } else if (!minorUpdate) {
    listJS.reIndex();
    listJS.update();
  }

  const modInfo = await mod.getInfo();
  if (modInfo) {
    replaceText('packages-mod-date', modInfo.packages_list.toLocaleString());
  } else {
    replaceText('packages-mod-date', '未取得');
  }

  showCheckDate();
}

/**
 * Checks the packages list.
 *
 * @param {HTMLButtonElement} btn - A HTMLElement of button element.
 * @param {HTMLDivElement} overlay - A overlay of packages list.
 * @param {string} instPath - An installation path.
 */
async function checkPackagesList(btn, overlay, instPath) {
  let enableButton;
  if (btn) enableButton = buttonTransition.loading(btn);

  if (overlay) {
    overlay.style.zIndex = 1000;
    overlay.classList.add('show');
  }

  try {
    await packageUtil.downloadRepository(setting.getPackagesDataUrl(instPath));
    await mod.downloadData();
    store.set('checkDate.packages', Date.now());
    await setPackagesList(instPath);

    if (btn) buttonTransition.message(btn, '更新完了', 'success');
  } catch {
    if (btn) buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
  }

  if (overlay) {
    overlay.classList.remove('show');
    overlay.style.zIndex = -1;
  }

  if (btn) {
    setTimeout(() => {
      enableButton();
      showCheckDate();
    }, 3000);
  }
}

/**
 * Installs a package to installation path.
 *
 * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
 * @param {string} instPath - An installation path.
 * @param {object} packageToInstall - A package to install.
 */
async function installPackage(btn, instPath, packageToInstall) {
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

  if (!packageToInstall && !selectedPackage) {
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

  const installedPackage = packageToInstall
    ? { ...packageToInstall }
    : { ...selectedPackage };

  const url = installedPackage.info.downloadURL;
  const archivePath = await ipcRenderer.invoke('open-browser', url, 'package');
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
    const unzippedPath = await unzip(archivePath, installedPackage.id);

    if (installedPackage.info.installer) {
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
            if (dirent.name === installedPackage.info.installer) {
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
        installedPackage.info.installArg
          .replace('"$instpath"', '$instpath')
          .replace('$instpath', '"' + instPath + '"'); // Prevent double quoting
      execSync(command);
    } else {
      const filesToCopy = [];
      for (const file of installedPackage.info.files) {
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
  for (const file of installedPackage.info.files) {
    if (!file.isOptional) {
      filesCount++;
      if (fs.existsSync(path.join(instPath, file.filename))) {
        existCount++;
      }
    }
  }

  if (filesCount === existCount) {
    apmJson.addPackage(instPath, installedPackage);
    await setPackagesList(instPath, true);

    buttonTransition.message(btn, 'インストール完了', 'success');
  } else {
    buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
  }

  setTimeout(() => {
    enableButton();
  }, 3000);
}

/**
 * Uninstalls a package to installation path.
 *
 * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
 * @param {string} instPath - An installation path.
 */
async function uninstallPackage(btn, instPath) {
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

  const uninstalledPackage = { ...selectedPackage };

  for (const file of uninstalledPackage.info.files) {
    fs.removeSync(path.join(instPath, file.filename));
  }

  let filesCount = 0;
  let existCount = 0;
  for (const file of uninstalledPackage.info.files) {
    if (!file.isOptional) {
      filesCount++;
      if (!fs.existsSync(path.join(instPath, file.filename))) {
        existCount++;
      }
    }
  }

  apmJson.removePackage(instPath, uninstalledPackage);
  if (filesCount === existCount) {
    if (!uninstalledPackage.id.startsWith('script_')) {
      await setPackagesList(instPath, true);
    } else {
      parseXML.removePackage(
        setting.getLocalPackagesDataUrl(instPath),
        uninstalledPackage
      );
      await checkPackagesList(null, null, instPath);
    }

    buttonTransition.message(btn, 'アンインストール完了', 'success');
  } else {
    buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
  }

  setTimeout(() => {
    enableButton();
  }, 3000);
}

/**
 * Open the download folder of the package.
 *
 * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
 */
async function openPackageFolder(btn) {
  const enableButton = buttonTransition.loading(btn);

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

  const exists = await ipcRenderer.invoke(
    'open-path',
    `package/${selectedPackage.id}`
  );

  if (!exists) {
    buttonTransition.message(
      btn,
      'このパッケージはダウンロードされていません。',
      'danger'
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    throw new Error('The package has not been downloaded.');
  }

  setTimeout(() => {
    enableButton();
  }, 3000);
}

/**
 * Installs a script to installation path.
 *
 * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
 * @param {string} instPath - An installation path.
 * @param {string} url - URL of the download site.
 */
async function installScript(btn, instPath, url) {
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

  const archivePath = await ipcRenderer.invoke('open-browser', url, 'package');
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

  const searchScriptFolders = (dirName, getFiles = false) => {
    const regex = /\.(anm|obj|cam|tra|scn)$/;
    const dirents = fs.readdirSync(dirName, {
      withFileTypes: true,
    });
    return [].concat(
      dirents.filter((i) => i.isFile() && regex.test(i.name)).length > 0
        ? getFiles
          ? dirents
              .filter((i) => i.isFile() && regex.test(i.name))
              .map((i) => path.join(path.basename(dirName), i.name))
          : [dirName]
        : [],
      dirents
        .filter((i) => i.isDirectory())
        .flatMap((i) =>
          searchScriptFolders(path.join(dirName, i.name), getFiles)
        )
    );
  };

  const searchPlugins = (dirName) => {
    const regex = /\.(auf|aui|auo|auc|aul)$/;
    const dirents = fs.readdirSync(dirName, {
      withFileTypes: true,
    });
    return dirents.filter((i) => i.isFile() && regex.test(i.name)).length > 0
      ? true
      : dirents
          .filter((i) => i.isDirectory())
          .map((i) => searchPlugins(path.join(dirName, i.name)))
          .some((e) => e);
  };

  try {
    const unzippedPath = await unzip(archivePath);
    const scriptFolders = searchScriptFolders(unzippedPath);
    const scriptFiles = searchScriptFolders(unzippedPath, true);
    const hasPlugin = searchPlugins(unzippedPath);

    if (scriptFiles.length === 0) {
      buttonTransition.message(btn, 'スクリプトが含まれていません。', 'danger');
      setTimeout(() => {
        enableButton();
      }, 3000);
      return;
    }

    if (hasPlugin) {
      buttonTransition.message(
        btn,
        'プラグインが含まれているためインストールできません。',
        'danger'
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
      return;
    }

    const foldersToCopy = scriptFolders.map((f) => [
      f,
      path.join(instPath, 'script', path.basename(f)),
    ]);
    for (const filePath of foldersToCopy) {
      fs.copySync(filePath[0], filePath[1]);
    }

    const name = path.basename(scriptFiles[0], path.extname(scriptFiles[0]));
    const id = 'script_' + getHash(name);

    const newPath = path.join(path.dirname(unzippedPath), id);
    if (fs.existsSync(newPath)) fs.rmdirSync(newPath, { recursive: true });
    fs.renameSync(unzippedPath, newPath);

    const d = new Date();
    const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}${String(d.getDate()).padStart(2, '0')}`;

    const package = {
      id: id,
      name: name,
      overview: 'スクリプト',
      description:
        'スクリプト一覧: ' + scriptFiles.map((f) => path.basename(f)).join(),
      developer: '-',
      pageURL: url,
      downloadURL: url,
      latestVersion: date,
      files: scriptFolders
        .map((f) => {
          return {
            filename: path
              .join('script', path.basename(f))
              .replaceAll('\\', '/'),
            isDirectory: true,
          };
        })
        .concat(
          scriptFiles.map((f) => {
            return {
              filename: path.join('script', f).replaceAll('\\', '/'),
            };
          })
        ),
    };

    parseXML.addPackage(setting.getLocalPackagesDataUrl(instPath), package);
    apmJson.addPackage(instPath, {
      id: package.id,
      repository: setting.getLocalPackagesDataUrl(instPath),
      info: package,
    });
    await checkPackagesList(null, null, instPath);
  } catch (e) {
    buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
    setTimeout(() => {
      enableButton();
    }, 3000);
    throw e;
  }

  buttonTransition.message(btn, 'インストール完了', 'success');

  setTimeout(() => {
    enableButton();
  }, 3000);
}

const filterButtons = new Set();
/**
 * Filter the list.
 *
 * @param {string} column - A column name to filter
 * @param {HTMLCollectionOf<HTMLButtonElement>} btns - A list of buttons
 * @param {HTMLButtonElement} btn - A button selected
 */
function listFilter(column, btns, btn) {
  if (btn.classList.contains('selected')) {
    btn.classList.remove('selected');
    listJS.filter();
  } else {
    for (const element of btns) {
      filterButtons.add(element);
    }

    for (const element of filterButtons) {
      element.classList.remove('selected');
    }

    let filterFunc;
    if (column === 'type') {
      const query = packageUtil.parsePackageType([btn.dataset.typeFilter]);
      filterFunc = (item) => {
        if (item.values().type.includes(query)) {
          return true;
        } else {
          return false;
        }
      };
    } else if (column === 'installedVersion') {
      const query = btn.dataset.installFilter;
      const getValue = (item) => {
        console.log(item.values().installedVersion);
        const valueSplit = item.values().installedVersion.split('<br>');
        return valueSplit[valueSplit.length - 1].trim();
      };
      if (query === 'true') {
        filterFunc = (item) => {
          const value = getValue(item);
          if (
            value === packageUtil.states.notInstalled ||
            value === packageUtil.states.manuallyInstalled ||
            value === packageUtil.states.otherInstalled
          ) {
            return false;
          } else {
            return true;
          }
        };
      } else if (query === 'manual') {
        filterFunc = (item) => {
          const value = getValue(item);
          if (value === packageUtil.states.manuallyInstalled) {
            return true;
          } else {
            return false;
          }
        };
      } else if (query === 'false') {
        filterFunc = (item) => {
          const value = getValue(item);
          if (
            value === packageUtil.states.notInstalled ||
            value === packageUtil.states.otherInstalled
          ) {
            return true;
          } else {
            return false;
          }
        };
      }
    }

    listJS.filter(filterFunc);
    btn.classList.add('selected');
  }
}

module.exports = {
  initPackage,
  setPackagesList,
  checkPackagesList,
  installPackage,
  uninstallPackage,
  openPackageFolder,
  installScript,
  listFilter,
};
