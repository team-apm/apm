const { ipcRenderer } = require('electron');
const Store = require('electron-store');
const store = new Store();
const log = require('electron-log');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const List = require('list.js');
const twemoji = require('twemoji');
const replaceText = require('../lib/replaceText');
const unzip = require('../lib/unzip');
const setting = require('../setting/setting');
const buttonTransition = require('../lib/buttonTransition');
const parseXML = require('../lib/parseXML');
const apmJson = require('../lib/apmJson');
const mod = require('../lib/mod');
const { getHash } = require('../lib/getHash');
const packageUtil = require('./packageUtil');
const integrity = require('../lib/integrity');

let selectedPackage;
let listJS;

/**
 * Get the date today
 *
 * @returns {string} Today's date
 */
function getDate() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}/${String(d.getDate()).padStart(2, '0')}`;
}

// Functions to be exported

/**
 * Get packages
 *
 * @param {string} instPath - An installation path
 * @returns {Promise.<object[]>} An object of packages
 */
async function getPackages(instPath) {
  return await packageUtil.getPackages(setting.getPackagesDataUrl(instPath));
}

/**
 * Sets rows of each package in the table.
 *
 * @param {string} instPath - An installation path.
 * @param {boolean} minorUpdate - Only the version of the installed package is updated.
 */
async function setPackagesList(instPath, minorUpdate = false) {
  const packagesSort = document.getElementById('packages-sort');
  const packagesList = document.getElementById('packages-list');
  const packagesList2 = document.getElementById('packages-list2');
  packagesList2.innerHTML = null;

  const columns = [
    'name',
    'overview',
    'developer',
    'type',
    'latestVersion',
    'installedVersion',
    'description',
    'pageURL',
  ];
  const columnsDisp = [
    '名前',
    '概要',
    '開発者',
    'タイプ',
    '最新バージョン',
    '現在バージョン',
    '解説',
    'リンク',
  ];
  const packages = await getPackages(instPath);

  // sort-buttons
  if (!packagesSort.hasChildNodes()) {
    Array.from(columns.entries())
      .filter(([n, s]) => ['name', 'developer'].includes(s))
      .forEach(([i, columnName]) => {
        const sortBtn = document
          .getElementById('sort-template')
          .cloneNode(true);
        sortBtn.removeAttribute('id');
        sortBtn.dataset.sort = columnName;
        sortBtn.innerText = columnsDisp[i];
        packagesSort.appendChild(sortBtn);
      });
  }

  // update the batch installation text
  const batchInstallElm = document.getElementById('batch-install-packages');
  batchInstallElm.innerText = packages
    .filter((p) => p.info.directURL)
    .map((p) => ' + ' + p.info.name)
    .join('');

  // prepare a package list
  let tmpInstalledPackages;
  let tmpInstalledFiles;
  let tmpManuallyInstalledFiles;
  const initLists = () => {
    tmpInstalledPackages = apmJson.get(instPath, 'packages');
    tmpInstalledFiles = packageUtil.getInstalledFiles(instPath);
    tmpManuallyInstalledFiles = packageUtil.getManuallyInstalledFiles(
      tmpInstalledFiles,
      tmpInstalledPackages,
      packages
    );
    packages.forEach((p) => {
      p.installedVersion = packageUtil.getInstalledVersionOfPackage(
        p,
        tmpInstalledFiles,
        tmpManuallyInstalledFiles,
        tmpInstalledPackages,
        instPath
      );
    });
  };
  initLists();

  // guess which packages are installed from integrity
  let modified = false;
  for (const p of packages
    .filter((p) => p.info.releases)
    .filter(
      (p) => p.installedVersion === packageUtil.states.manuallyInstalled
    )) {
    for (const release of Object.values(p.info.releases)) {
      if (await integrity.checkIntegrity(instPath, release.integrities)) {
        apmJson.addPackage(instPath, p);
        modified = true;
      }
    }
  }
  if (modified) initLists();

  const manuallyInstalledFiles = tmpManuallyInstalledFiles;

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
        // Whether there is at least one package that is not installable
        return p.info.dependencies.dependency
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

    const isInstalled = (p) =>
      p.installedVersion !== packageUtil.states.installedButBroken &&
      p.installedVersion !== packageUtil.states.notInstalled &&
      p.installedVersion !== packageUtil.states.otherInstalled;
    const detached = (p) => {
      const lists = [];
      if (!isInstalled(p)) lists.push(p);
      if (p.info.dependencies) {
        lists.push(
          ...p.info.dependencies.dependency.flatMap((ids) => {
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

            // If all id's are detached, perform a list fetch for the first id
            const id = ids.split('|')[0];
            if (aviUtlR.test(id) || exeditR.test(id)) {
              return [];
            }
            return packages
              .filter((pp) => pp.id === id)
              .flatMap((pp) => detached(pp));
          })
        );
      }
      return lists;
    };
    p.detached = isInstalled(p) ? detached(p) : [];
  });

  const makeLiFromArray = (columnList) => {
    const li = document.getElementById('list-template').cloneNode(true);
    li.removeAttribute('id');
    const divs = columnList.map(
      (tdName) => li.getElementsByClassName(tdName)[0]
    );
    return [li].concat(divs);
  };

  if (!minorUpdate) {
    packagesList.innerHTML = null;

    for (const package of packages) {
      const [
        li,
        name,
        overview,
        developer,
        type,
        latestVersion,
        installedVersion,
        description,
        pageURL,
      ] = makeLiFromArray(columns);
      li.dataset.id = package.id;
      li.dataset.repository = package.repository;
      li.addEventListener('click', (event) => {
        selectedPackage = package;
        li.getElementsByTagName('input')[0].checked = true;
        for (const tmpli of packagesList.getElementsByTagName('li')) {
          tmpli.classList.remove('list-group-item-secondary');
        }
        li.classList.add('list-group-item-secondary');
      });
      name.innerText = package.info.name;
      overview.innerText = package.info.overview;
      developer.innerText = package.info.originalDeveloper
        ? `${package.info.developer}（オリジナル：${package.info.originalDeveloper}）`
        : package.info.developer;
      packageUtil.parsePackageType(package.info.type).forEach((e) => {
        const typeItem = document
          .getElementById('tag-template')
          .cloneNode(true);
        typeItem.removeAttribute('id');
        typeItem.innerText = e;
        type.appendChild(typeItem);
      });
      latestVersion.innerText = package.info.latestVersion;
      // temporary string for sorting or filtering
      installedVersion.innerText = package.installedVersion;
      description.innerText = package.info.description;
      pageURL.innerText = package.info.pageURL;
      pageURL.href = package.info.pageURL;

      packagesList.appendChild(li);
    }

    // sorting and filtering
    // this must be done before setting the click event for the installedVersion element
    if (typeof listJS === 'undefined') {
      listJS = new List('packages', { valueNames: columns });
    } else {
      listJS.reIndex();
      listJS.update();
    }
  }

  for (const package of packages) {
    for (const li of packagesList.getElementsByTagName('li')) {
      if (
        li.dataset.id === package.id &&
        li.dataset.repository === package.repository
      ) {
        const installedVersion =
          li.getElementsByClassName('installedVersion')[0];
        installedVersion.innerText = null;
        package.detached.forEach((p) => {
          const aTag = document.createElement('a');
          aTag.href = '#';
          aTag.innerText = `❗ 要導入: ${p.info.name}\r\n`;
          installedVersion.appendChild(aTag);
          aTag.addEventListener('click', async (event) => {
            await installPackage(instPath, p);
            return false;
          });
        });
        const verText = document.createElement('div');
        verText.innerText =
          (package.doNotInstall ? '⚠️インストール不可\r\n' : '') +
          package.installedVersion;
        installedVersion.appendChild(verText);
      }
    }
  }
  twemoji.parse(packagesList);

  // list manually added packages
  for (const ef of manuallyInstalledFiles) {
    const [
      li,
      name,
      overview,
      developer,
      type,
      latestVersion,
      installedVersion,
    ] = makeLiFromArray(columns);
    li.classList.add('list-group-item-secondary');
    li.getElementsByTagName('input')[0].remove(); // remove the radio button
    name.innerText = ef;
    overview.innerText = '手動で追加されたファイル';
    developer.innerText = '';
    type.innerText = '';
    latestVersion.innerText = '';
    installedVersion.innerText = '';
    packagesList2.appendChild(li);
  }

  if (store.has('modDate.packages')) {
    const modDate = new Date(store.get('modDate.packages'));
    replaceText('packages-mod-date', modDate.toLocaleString());

    const checkDate = new Date(store.get('checkDate.packages'));
    replaceText('packages-check-date', checkDate.toLocaleString());
  } else {
    replaceText('packages-mod-date', '未取得');

    replaceText('packages-check-date', '未確認');
  }
}

/**
 * Checks the packages list.
 *
 * @param {string} instPath - An installation path.
 */
async function checkPackagesList(instPath) {
  const btn = document.getElementById('check-packages-list');
  let enableButton;
  if (btn) enableButton = buttonTransition.loading(btn, '更新を確認');

  const overlay = document.getElementById('packages-table-overlay');
  if (overlay) {
    overlay.style.zIndex = 1000;
    overlay.classList.add('show');
  }

  try {
    await packageUtil.downloadRepository(setting.getPackagesDataUrl(instPath));
    await mod.downloadData();
    store.set('checkDate.packages', Date.now());
    const modInfo = await mod.getInfo();
    store.set('modDate.packages', modInfo.packages.getTime());
    await setPackagesList(instPath);

    if (btn) buttonTransition.message(btn, '更新完了', 'success');
  } catch (e) {
    if (btn) buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
    log.error(e);
  }

  if (overlay) {
    overlay.classList.remove('show');
    overlay.style.zIndex = -1;
  }

  if (btn) {
    setTimeout(() => {
      enableButton();
    }, 3000);
  }
}

/**
 * Installs a package to installation path.
 *
 * @param {string} instPath - An installation path.
 * @param {object} packageToInstall - A package to install.
 * @param {boolean} direct - Install from the direct link to the zip.
 */
async function installPackage(instPath, packageToInstall, direct = false) {
  const btn = document.getElementById('install-package');
  const enableButton = btn
    ? buttonTransition.loading(btn, 'インストール')
    : null;

  if (!instPath) {
    if (btn) {
      buttonTransition.message(
        btn,
        'インストール先フォルダを指定してください。',
        'danger'
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
    log.error('An installation path is not selected.');
    return;
  }

  if (!packageToInstall && !selectedPackage) {
    if (btn) {
      buttonTransition.message(
        btn,
        'プラグインまたはスクリプトを選択してください。',
        'danger'
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
    log.error('A package to install is not selected.');
    return;
  }

  const installedPackage = packageToInstall
    ? { ...packageToInstall }
    : { ...selectedPackage };

  let archivePath = '';
  if (direct) {
    archivePath = await ipcRenderer.invoke(
      'download',
      installedPackage.info.directURL,
      true,
      'package'
    );
  } else {
    archivePath = await ipcRenderer.invoke(
      'open-browser',
      installedPackage.info.downloadURL,
      'package'
    );
    if (archivePath === 'close') {
      if (btn) {
        buttonTransition.message(
          btn,
          'インストールがキャンセルされました。',
          'info'
        );
        setTimeout(() => {
          enableButton();
        }, 3000);
      }
      return;
    }
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
    if (btn) {
      buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
    log.error(e);
    return;
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
    if (installedPackage.info.isContinuous)
      installedPackage.info = {
        ...installedPackage.info,
        latestVersion: getDate(),
      };
    apmJson.addPackage(instPath, installedPackage);
    await setPackagesList(instPath, true);

    if (btn) buttonTransition.message(btn, 'インストール完了', 'success');
  } else {
    if (btn) buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
  }

  if (btn) {
    setTimeout(() => {
      enableButton();
    }, 3000);
  }
}

/**
 * Uninstalls a package to installation path.
 *
 * @param {string} instPath - An installation path.
 */
async function uninstallPackage(instPath) {
  const btn = document.getElementById('uninstall-package');
  const enableButton = buttonTransition.loading(btn, 'アンインストール');

  if (!instPath) {
    buttonTransition.message(
      btn,
      'インストール先フォルダを指定してください。',
      'danger'
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    log.error('An installation path is not selected.');
    return;
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
    log.error('A package to install is not selected.');
    return;
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
      await parseXML.removePackage(
        setting.getLocalPackagesDataUrl(instPath),
        uninstalledPackage
      );
      await checkPackagesList(instPath);
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
 */
async function openPackageFolder() {
  const btn = document.getElementById('open-package-folder');
  const enableButton = buttonTransition.loading(
    btn,
    'ダウンロードフォルダを開く'
  );

  if (!selectedPackage) {
    buttonTransition.message(
      btn,
      'プラグインまたはスクリプトを選択してください。',
      'danger'
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    log.error('A package to install is not selected.');
    return;
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
    log.error('The package has not been downloaded.');
    return;
  }

  setTimeout(() => {
    enableButton();
  }, 3000);
}

/**
 * Installs a script to installation path.
 *
 * @param {string} instPath - An installation path.
 * @param {string} url - URL of the download site.
 */
async function installScript(instPath, url) {
  const btn = document.getElementById('install-script-indication');
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
    log.error('An installation path is not selected.');
    return;
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

    const package = {
      id: id,
      name: name,
      overview: 'スクリプト',
      description:
        'スクリプト一覧: ' + scriptFiles.map((f) => path.basename(f)).join(),
      developer: '-',
      pageURL: url,
      downloadURL: url,
      latestVersion: getDate(),
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

    await parseXML.addPackage(
      setting.getLocalPackagesDataUrl(instPath),
      package
    );
    apmJson.addPackage(instPath, {
      id: package.id,
      repository: setting.getLocalPackagesDataUrl(instPath),
      info: package,
    });
    await checkPackagesList(instPath);
  } catch (e) {
    buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
    setTimeout(() => {
      enableButton();
    }, 3000);
    log.error(e);
    return;
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
      const query = packageUtil
        .parsePackageType([btn.dataset.typeFilter])
        .toString();
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
  getPackages,
  setPackagesList,
  checkPackagesList,
  installPackage,
  uninstallPackage,
  openPackageFolder,
  installScript,
  listFilter,
};
