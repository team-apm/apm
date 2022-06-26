import { execSync } from 'child_process';
import log from 'electron-log';
import Store from 'electron-store';
import {
  copy,
  existsSync,
  mkdir,
  readdir,
  readdirSync,
  readJsonSync,
  rename,
  renameSync,
  rmdirSync,
} from 'fs-extra';
import * as matcher from 'matcher';
import path from 'path';
import { safeRemove } from '../../lib/safeRemove';
import twemoji from 'twemoji';
import apmJson from '../../lib/apmJson';
import buttonTransition from '../../lib/buttonTransition';
import { compareVersion } from '../../lib/compareVersion';
import { getHash } from '../../lib/getHash';
import integrity from '../../lib/integrity';
import {
  download,
  getNicommonsData,
  openBrowser,
  openPath,
  openYesNoDialog,
} from '../../lib/ipcWrapper';
import modList from '../../lib/modList';
import parseJson from '../../lib/parseJson';
import replaceText from '../../lib/replaceText';
import unzip from '../../lib/unzip';
import createList from '../../lib/updatableList';
import { install, verifyFilesByCount } from './common';
import packageUtil from './packageUtil';
const store = new Store();
/** @typedef {import("apm-schema").Scripts} Scripts */

// To avoid a bug in the library
// https://github.com/sindresorhus/matcher/issues/32
const isMatch = (input, pattern) =>
  pattern.some((p) => matcher.isMatch(input, p));

let selectedEntry;
let selectedEntryType;
const entryType = { package: 'package', scriptSite: 'script' };
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
  return await packageUtil.getPackages(modList.getPackagesDataUrl(instPath));
}

/**
 * Sets rows of each package in the table.
 *
 * @param {string} instPath - An installation path.
 */
async function setPackagesList(instPath) {
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
    'installationStatus',
    'description',
    'pageURL',
    'dependencyInformation',
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
    '依存関係',
  ];
  let packages = await getPackages(instPath);

  // sort-buttons
  if (!packagesSort.hasChildNodes()) {
    const sortButtons = Array.from(columns.entries())
      .filter(([, s]) => ['name', 'developer'].includes(s))
      .map(([i, columnName]) => {
        const sortBtn = document
          .getElementById('sort-template')
          .cloneNode(true);
        sortBtn.removeAttribute('id');
        sortBtn.dataset.sort = columnName;
        sortBtn.innerText = columnsDisp[i];
        return sortBtn;
      });
    sortButtons[0].classList.add('asc');
    sortButtons.forEach((sortBtn) => packagesSort.appendChild(sortBtn));
  }

  // prepare a package list

  let manuallyInstalledFiles;
  const packagesExtra = packageUtil.getPackagesExtra(packages, instPath);
  manuallyInstalledFiles = packagesExtra.manuallyInstalledFiles;
  packages = packagesExtra.packages;

  // guess which packages are installed from integrity
  let modified = false;
  for (const p of packages.filter(
    (p) =>
      p.info.releases &&
      p.installationStatus === packageUtil.states.manuallyInstalled
  )) {
    for (const release of p.info.releases) {
      if (await integrity.checkIntegrity(instPath, release.integrity.file)) {
        apmJson.addPackage(instPath, {
          ...p,
          info: { ...p.info, latestVersion: release.version },
        });
        modified = true;
      }
    }
  }
  if (modified) {
    const packagesExtraMod = packageUtil.getPackagesExtra(packages, instPath);
    manuallyInstalledFiles = packagesExtraMod.manuallyInstalledFiles;
    packages = packagesExtraMod.packages;
  }

  packages = packageUtil.getPackagesStatus(instPath, packages);

  // show the package list
  const makeLiFromArray = (columnList) => {
    const li = document.getElementById('list-template').cloneNode(true);
    li.removeAttribute('id');
    const divs = columnList.map(
      (tdName) => li.getElementsByClassName(tdName)[0]
    );
    return [li].concat(divs);
  };

  packagesList.innerHTML = null;

  for (const packageItem of packages) {
    const [
      li,
      name,
      overview,
      developer,
      type,
      latestVersion,
      installationStatus,
      description,
      pageURL,
      dependencyInformation,
      statusInformation,
    ] = makeLiFromArray([...columns, 'statusInformation']);
    li.addEventListener('click', () => {
      selectedEntry = packageItem;
      selectedEntryType = entryType.package;
      li.getElementsByTagName('input')[0].checked = true;
      for (const tmpli of packagesList.getElementsByTagName('li')) {
        tmpli.classList.remove('list-group-item-secondary');
      }
      li.classList.add('list-group-item-secondary');
    });
    name.innerText = packageItem.info.name;
    overview.innerText = packageItem.info.overview;
    developer.innerText = packageItem.info.originalDeveloper
      ? `${packageItem.info.developer}（オリジナル：${packageItem.info.originalDeveloper}）`
      : packageItem.info.developer;
    packageUtil.parsePackageType(packageItem.type).forEach((e) => {
      const typeItem = document.getElementById('tag-template').cloneNode(true);
      typeItem.removeAttribute('id');
      typeItem.innerText = e;
      type.appendChild(typeItem);
    });
    latestVersion.innerText = packageItem.info.latestVersion;
    installationStatus.innerText =
      packageItem.installationStatus +
      (packageItem.installationStatus === packageUtil.states.installed
        ? ': ' + packageItem.version
        : '');
    description.innerText = packageItem.info.description;
    pageURL.innerText = packageItem.info.pageURL;
    pageURL.href = packageItem.info.pageURL;
    dependencyInformation.innerText =
      packageItem.info.dependencies
        ?.map((ids) =>
          [
            ...new Set(
              ids
                .split('|')
                .map((id) => packages.find((p) => p.id === id)?.info?.name)
            ),
          ].join(' or ')
        )
        .flatMap((text) => (text ? ['🔗 ' + text] : []))
        .join(' ') ?? '';
    statusInformation.innerText = null;
    packageItem.detached.forEach((p) => {
      const aTag = document.createElement('a');
      aTag.href = '#';
      aTag.innerText = `❗ 要導入: ${p.info.name}\r\n`;
      statusInformation.appendChild(aTag);
      aTag.addEventListener('click', async () => {
        await installPackage(instPath, p);
        return false;
      });
    });
    const verText = document.createElement('div');
    verText.innerText = packageItem.doNotInstall
      ? '⚠️インストール不可\r\n'
      : '';
    statusInformation.appendChild(verText);
    if (
      packageItem.installationStatus === packageUtil.states.installed &&
      compareVersion(packageItem.info.latestVersion, packageItem.version) > 0
    ) {
      const updateText = document.createElement('div');
      updateText.classList.add('text-success');
      updateText.innerText = '更新が利用可能です\r\n';
      statusInformation.appendChild(updateText);
    }

    packagesList.appendChild(li);
  }

  for (const webpage of (await getScriptsList()).webpage) {
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
      dependencyInformation,
      statusInformation,
    ] = makeLiFromArray([...columns, 'statusInformation']);
    li.addEventListener('click', () => {
      selectedEntry = webpage;
      selectedEntryType = entryType.scriptSite;
      li.getElementsByTagName('input')[0].checked = true;
      for (const tmpli of packagesList.getElementsByTagName('li')) {
        tmpli.classList.remove('list-group-item-secondary');
      }
      li.classList.add('list-group-item-secondary');
    });
    name.innerText = webpage.developer;
    overview.innerText = '配布サイトからスクリプトをインストール';
    developer.innerText = webpage.developer;
    const typeItem = document.getElementById('tag-template').cloneNode(true);
    typeItem.removeAttribute('id');
    typeItem.classList.replace(
      'list-group-item-secondary',
      'list-group-item-success'
    );
    typeItem.innerText = 'スクリプト配布サイト';
    type.appendChild(typeItem);
    latestVersion.innerText = '';
    installedVersion.innerText = '';
    description.innerText = webpage?.description ?? '';
    pageURL.innerText = webpage.url;
    pageURL.href = webpage.url;
    dependencyInformation.innerText = '';
    statusInformation.innerText = '';

    packagesList.appendChild(li);
  }

  // sorting and filtering
  if (typeof listJS === 'undefined') {
    listJS = createList('packages', {
      valueNames: columns,
      fuzzySearch: { distance: 10000 }, // Ensure that searches are performed even on long strings.
    });
  } else {
    listJS.reIndex();
    listJS.update();
  }

  // parse emoji
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
      installationStatus,
    ] = makeLiFromArray(columns);
    li.classList.add('list-group-item-secondary');
    li.getElementsByTagName('input')[0].remove(); // remove the radio button
    name.innerText = ef;
    overview.innerText = '手動で追加されたファイル';
    developer.innerText = '';
    type.innerText = '';
    latestVersion.innerText = '';
    installationStatus.innerText = '';
    packagesList2.appendChild(li);
  }

  // update the batch installation text
  const batchInstallElm = document.getElementById('batch-install-packages');
  batchInstallElm.innerHTML = null;
  packages
    .filter((p) => p.info.directURL)
    .flatMap((p) => {
      if (p.installationStatus !== packageUtil.states.notInstalled) {
        const pTag = document.createElement('span');
        pTag.classList.add('text-muted');
        pTag.innerText = '✔' + p.info.name;
        return [document.createTextNode(' + '), pTag];
      } else {
        return [document.createTextNode(' + ' + p.info.name)];
      }
    })
    .forEach((e) => batchInstallElm.appendChild(e));

  // settings page
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
  if (btn) enableButton = buttonTransition.loading(btn, '更新');

  const overlay = document.getElementById('packages-table-overlay');
  if (overlay) {
    overlay.style.zIndex = 1000;
    overlay.classList.add('show');
  }

  try {
    await packageUtil.downloadRepository(modList.getPackagesDataUrl(instPath));
    await modList.updateInfo();
    store.set('checkDate.packages', Date.now());
    const modInfo = await modList.getInfo();
    store.set(
      'modDate.packages',
      Math.max(...modInfo.packages.map((p) => new Date(p.modified).getTime()))
    );
    await setPackagesList(instPath);
    await displayNicommonsIdList(instPath);

    if (btn) buttonTransition.message(btn, '更新完了', 'success');
  } catch (e) {
    log.error(e);
    if (btn) buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
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
 * Checks the scripts list.
 *
 * @param {boolean} update - Download the json file.
 * @returns {Promise<Scripts>} - An object parsed from scripts.json.
 */
async function getScriptsList(update = false) {
  const dictUrl = await modList.getScriptsDataUrl();
  /** @type {Scripts} */
  const result = {
    webpage: [],
    scripts: [],
  };

  for (const url of dictUrl) {
    const scriptsJson = await download(url, {
      loadCache: !update,
      subDir: 'package',
      keyText: url,
    });
    if (!scriptsJson) continue;
    /** @type {Scripts} */
    const json = readJsonSync(scriptsJson);
    result.webpage = result.webpage.concat(json.webpage);
    result.scripts = result.scripts.concat(json.scripts);
  }

  if (update) {
    const currentMod = await modList.getInfo();
    store.set(
      'modDate.scripts',
      Math.max(...currentMod.scripts.map((p) => new Date(p.modified).getTime()))
    );
  }

  return result;
}

/**
 * Installs a package to installation path.
 *
 * @param {string} instPath - An installation path.
 * @param {object} [packageToInstall] - A package to install.
 * @param {boolean} [direct] - Install from the direct link to the zip.
 * @param {string} [strArchivePath] - Path to the downloaded archive.
 */
async function installPackage(
  instPath,
  packageToInstall,
  direct = false,
  strArchivePath
) {
  const roles = {
    Event_Handler: 'Event_Handler',
    Internal_Local_File: 'Internal_Local_File',
    Internal_Direct_Link: 'Internal_Direct_Link',
    Internal_Browser: 'Internal_Browser',
  };
  let role;
  if (strArchivePath) {
    role = roles.Internal_Local_File;
  } else if (direct) {
    role = roles.Internal_Direct_Link;
  } else if (packageToInstall) {
    role = roles.Internal_Browser;
  } else {
    role = roles.Event_Handler;
  }

  if (
    role === roles.Event_Handler &&
    selectedEntryType === entryType.scriptSite
  ) {
    installScript(instPath);
    return;
  }

  const btn = document.getElementById('install-package');
  const enableButton = btn
    ? buttonTransition.loading(btn, 'インストール')
    : null;

  if (!instPath) {
    log.error('An installation path is not selected.');
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
    return;
  }

  let installedPackage;

  if (packageToInstall) {
    installedPackage = { ...packageToInstall };
  } else {
    if (!selectedEntry) {
      log.error('A package to install is not selected.');
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
      return;
    }

    if (selectedEntry.id?.startsWith('script_')) {
      log.error('This script cannot be overwritten.');
      if (btn) {
        buttonTransition.message(
          btn,
          'このスクリプトは上書きインストールできません。',
          'danger'
        );
        setTimeout(() => {
          enableButton();
        }, 3000);
      }
      return;
    }

    installedPackage = { ...selectedEntry };
  }

  let archivePath = '';
  if (role === roles.Internal_Local_File) {
    archivePath = strArchivePath;
  } else if (role === roles.Internal_Direct_Link) {
    archivePath = await download(installedPackage.info.directURL, {
      loadCache: true,
      subDir: 'package',
    });

    if (!archivePath) {
      log.error('Failed downloading a file.');
      if (btn) {
        buttonTransition.message(
          btn,
          'ダウンロード中にエラーが発生しました。',
          'danger'
        );
        setTimeout(() => {
          enableButton();
        }, 3000);
      }
      return;
    }

    const integrityForArchive = installedPackage.info.releases?.find(
      (r) => r.version === installedPackage.info.latestVersion
    )?.integrity?.archive;

    if (integrityForArchive) {
      // Verify file integrity
      while (!(await integrity.verifyFile(archivePath, integrityForArchive))) {
        const dialogResult = await openYesNoDialog(
          'エラー',
          'ダウンロードされたファイルは破損しています。再ダウンロードしますか？'
        );

        if (!dialogResult) {
          log.error(
            `The downloaded archive file is corrupt. URL:${installedPackage.info.directURL}`
          );
          if (btn) {
            buttonTransition.message(
              btn,
              'ダウンロードされたファイルは破損しています。',
              'danger'
            );
            setTimeout(() => {
              enableButton();
            }, 3000);
          }
          // Direct installation can throw an error because it is called only from within the try catch block.
          throw new Error('The downloaded archive file is corrupt.');
        }

        archivePath = await download(installedPackage.info.directURL, {
          subDir: 'core',
        });
        if (!archivePath) {
          log.error(
            `Failed downloading the archive file. URL:${installedPackage.info.directURL}`
          );
          if (btn) {
            buttonTransition.message(
              btn,
              'ファイルのダウンロードに失敗しました。',
              'danger'
            );
            setTimeout(() => {
              enableButton();
            }, 3000);
          }
          // Direct installation can throw an error because it is called only from within the try catch block.
          throw new Error('Failed downloading the archive file.');
        }
      }
    }
  } else {
    // if (role === roles.Internal_Browser || role === roles.Event_Handler)

    const downloadResult = await openBrowser(
      installedPackage.info.downloadURLs[0],
      'package'
    );

    if (!downloadResult) {
      log.info('The installation was canceled.');
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

    archivePath = downloadResult.savePath;
  }

  let installResult = false;

  try {
    const getUnzippedPath = async () => {
      if (['.zip', '.lzh', '.7z', '.rar'].includes(path.extname(archivePath))) {
        return await unzip(archivePath, installedPackage.id);
      } else {
        // In this line, path.dirname(archivePath) always refers to the 'Data/package' folder.
        const newFolder = path.join(
          path.dirname(archivePath),
          installedPackage.id
        );
        await mkdir(newFolder, { recursive: true });
        await rename(
          archivePath,
          path.join(newFolder, path.basename(archivePath))
        );
        return newFolder;
      }
    };

    const unzippedPath = await getUnzippedPath();

    if (installedPackage.info.installer) {
      const searchFiles = (dirName) => {
        let result = [];
        const dirents = readdirSync(dirName, {
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

      installResult = verifyFilesByCount(instPath, installedPackage.info.files);
    } else {
      installResult = await install(
        unzippedPath,
        instPath,
        installedPackage.info.files
      );
    }
  } catch (e) {
    log.error(e);
    installResult = false;
  }

  if (installResult) {
    if (installedPackage.info.isContinuous)
      installedPackage.info = {
        ...installedPackage.info,
        latestVersion: getDate(),
      };
    apmJson.addPackage(instPath, installedPackage);
    await setPackagesList(instPath);
    await displayNicommonsIdList(instPath);

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

  if (selectedEntryType !== entryType.package) {
    log.error('A package to install is not selected.');
    buttonTransition.message(
      btn,
      'プラグインまたはスクリプトを選択してください。',
      'danger'
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  if (!instPath) {
    log.error('An installation path is not selected.');
    buttonTransition.message(
      btn,
      'インストール先フォルダを指定してください。',
      'danger'
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  if (!selectedEntry) {
    log.error('A package to install is not selected.');
    buttonTransition.message(
      btn,
      'プラグインまたはスクリプトを選択してください。',
      'danger'
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  const uninstalledPackage = { ...selectedEntry };

  const filesToRemove = [];
  for (const file of uninstalledPackage.info.files) {
    if (!file.isInstallOnly)
      filesToRemove.push(path.join(instPath, file.filename));
  }

  try {
    await Promise.all(
      filesToRemove.map((filePath) => safeRemove(filePath, instPath))
    );
  } catch (e) {
    log.error(e);
    buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  let filesCount = 0;
  let notExistCount = 0;
  for (const file of uninstalledPackage.info.files) {
    if (!file.isInstallOnly) {
      filesCount++;
      if (!existsSync(path.join(instPath, file.filename))) {
        notExistCount++;
      }
    }
  }

  apmJson.removePackage(instPath, uninstalledPackage);
  if (filesCount === notExistCount) {
    if (!uninstalledPackage.id.startsWith('script_')) {
      await setPackagesList(instPath);
      await displayNicommonsIdList(instPath);
    } else {
      await parseJson.removePackage(
        modList.getLocalPackagesDataUrl(instPath),
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

  if (selectedEntryType !== entryType.package) {
    log.error('A package to install is not selected.');
    buttonTransition.message(
      btn,
      'プラグインまたはスクリプトを選択してください。',
      'danger'
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  if (!selectedEntry) {
    log.error('A package to install is not selected.');
    buttonTransition.message(
      btn,
      'プラグインまたはスクリプトを選択してください。',
      'danger'
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  const exists = await openPath(`package/${selectedEntry.id}`);

  if (!exists) {
    log.error('The package has not been downloaded.');
    buttonTransition.message(
      btn,
      'このパッケージはダウンロードされていません。',
      'danger'
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
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
 */
async function installScript(instPath) {
  const btn = document.getElementById('install-package');
  const enableButton = buttonTransition.loading(btn);
  const url = selectedEntry.url;

  if (!instPath) {
    log.error('An installation path is not selected.');
    buttonTransition.message(
      btn,
      'インストール先フォルダを指定してください。',
      'danger'
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  const downloadResult = await openBrowser(url, 'package');
  if (!downloadResult) {
    log.info('The installation was canceled.');
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

  const archivePath = downloadResult.savePath;
  const history = downloadResult.history;
  const matchInfo = [...(await getScriptsList()).scripts]
    .reverse()
    .find((item) => isMatch(history, item.match));

  if (!matchInfo) {
    log.error('The script is not supported.');
    buttonTransition.message(btn, '未対応のスクリプトです。', 'danger');
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  if (matchInfo?.redirect) {
    // Determine which of the redirections can be installed and install them.
    let packages = await getPackages(instPath);
    packages = packageUtil.getPackagesExtra(packages, instPath).packages;
    packages = packageUtil.getPackagesStatus(instPath, packages);
    const packageId = matchInfo.redirect
      .split('|')
      .find((candidate) =>
        packages.find((p) => p.id === candidate && p.doNotInstall !== true)
      );
    if (packageId) {
      await installPackage(
        instPath,
        packages.find((p) => p.id === packageId),
        undefined,
        archivePath
      );
    } else {
      buttonTransition.message(
        btn,
        '指定されたパッケージは存在しません。',
        'danger'
      );
    }
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  const pluginExtRegex = /\.(auf|aui|auo|auc|aul)$/;
  const scriptExtRegex = /\.(anm|obj|cam|tra|scn)$/;

  const searchScriptRoot = (dirName) => {
    const dirents = readdirSync(dirName, {
      withFileTypes: true,
    });
    return dirents.find((i) => i.isFile() && scriptExtRegex.test(i.name))
      ? [dirName]
      : dirents
          .filter((i) => i.isDirectory())
          .flatMap((i) => searchScriptRoot(path.join(dirName, i.name)));
  };

  const extExists = (dirName, regex) => {
    const dirents = readdirSync(dirName, {
      withFileTypes: true,
    });
    return dirents.filter((i) => i.isFile() && regex.test(i.name)).length > 0
      ? true
      : dirents
          .filter((i) => i.isDirectory())
          .map((i) => extExists(path.join(dirName, i.name), regex))
          .some((e) => e);
  };

  try {
    const getUnzippedPath = async () => {
      if (['.zip', '.lzh', '.7z', '.rar'].includes(path.extname(archivePath))) {
        return await unzip(archivePath);
      } else {
        // In this line, path.dirname(archivePath) always refers to the 'Data/package' folder.
        const newFolder = path.join(
          path.dirname(archivePath),
          'tmp_' + path.basename(archivePath)
        );
        await mkdir(newFolder, { recursive: true });
        await rename(
          archivePath,
          path.join(newFolder, path.basename(archivePath))
        );
        return newFolder;
      }
    };
    const unzippedPath = await getUnzippedPath();

    if (!extExists(unzippedPath, scriptExtRegex)) {
      log.error('No script files are included.');
      buttonTransition.message(btn, 'スクリプトが含まれていません。', 'danger');
      setTimeout(() => {
        enableButton();
      }, 3000);
      return;
    }
    if (extExists(unzippedPath, pluginExtRegex)) {
      log.error('Plugin files are included.');
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
    const scriptRoot = searchScriptRoot(unzippedPath)[0];
    const entriesToCopy = (
      await readdir(scriptRoot, {
        withFileTypes: true,
      })
    )
      .filter((p) => !isMatch([p.name], denyList))
      .map((p) => [
        path.join(scriptRoot, p.name),
        path.join(instPath, 'script', matchInfo.folder, p.name),
        path.join('script', matchInfo.folder, p.name).replaceAll('\\', '/'),
        p.isDirectory(),
      ]);
    await mkdir(path.join(instPath, 'script', matchInfo.folder), {
      recursive: true,
    });
    await Promise.all(
      entriesToCopy.map((filePath) => copy(filePath[0], filePath[1]))
    );

    // Constructing package information
    const files = entriesToCopy.map((i) => {
      return { filename: i[2], isDirectory: i[3] };
    });

    const filteredFiles = files.filter((f) => scriptExtRegex.test(f.filename));
    const name = path.basename(
      filteredFiles[0].filename,
      path.extname(filteredFiles[0].filename)
    );
    const id = 'script_' + getHash(name);

    // Rename the extracted folder
    const newPath = path.join(path.dirname(unzippedPath), id);
    if (existsSync(newPath)) rmdirSync(newPath, { recursive: true });
    renameSync(unzippedPath, newPath);

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
      downloadURLs: [url],
      latestVersion: getDate(),
      files: files,
    };

    await parseJson.addPackage(
      modList.getLocalPackagesDataUrl(instPath),
      packageItem
    );
    apmJson.addPackage(instPath, {
      id: packageItem.id,
      info: packageItem,
    });
    await checkPackagesList(instPath);

    buttonTransition.message(btn, 'インストール完了', 'success');
  } catch (e) {
    log.error(e);
    buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
  }

  setTimeout(() => {
    enableButton();
  }, 3000);
}

const filterButtons = new Set();
/**
 * Filter the list.
 *
 * @typedef {HTMLCollection} HTMLCollectionOf
 * @param {string} column - A column name to filter
 * @param {HTMLCollectionOf<HTMLButtonElement>} btns - A list of buttons
 * @param {HTMLButtonElement} btn - A button selected
 */
function listFilter(column, btns, btn) {
  if (btn.classList.contains('selected')) {
    btn.classList.remove('selected');
    listJS.filter();
    listJS.update();
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
    } else if (column === 'installationStatus') {
      const query = btn.dataset.installFilter;
      const getValue = (item) => {
        return item.values().installationStatus;
      };
      if (query === 'true') {
        filterFunc = (item) => {
          const value = getValue(item);
          if (
            value.startsWith(packageUtil.states.installed) ||
            value === packageUtil.states.installedButBroken
          ) {
            return true;
          } else {
            return false;
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
    listJS.update();
    btn.classList.add('selected');
  }
}

/**
 * Returns a nicommonsID list separated by space.
 *
 * @param {string} instPath - An installation path.
 */
async function displayNicommonsIdList(instPath) {
  const packages = await getPackages(instPath);
  const packagesWithNicommonsId = [
    {
      info: { name: 'AviUtl', developer: 'KENくん', nicommons: 'im1696493' },
      type: [],
    },
    {
      info: {
        name: 'AviUtl Package Manager',
        developer: 'Team apm',
        nicommons: 'nc251912',
      },
      type: [],
    },
    ...packages.filter((value) => {
      return (
        apmJson.has(instPath, 'packages.' + value.id) && value.info.nicommons
      );
    }),
  ];

  // show the package list
  const columns = ['thumbnail', 'name', 'developer', 'type', 'nicommons'];
  const makeLiFromArray = (columnList) => {
    const li = document.getElementById('nicommons-id-template').cloneNode(true);
    li.removeAttribute('id');
    const divs = columnList.map(
      (tdName) => li.getElementsByClassName(tdName)[0]
    );
    return [li].concat(divs);
  };

  const updateTextarea = () => {
    const checkedId = [];
    document.getElementsByName('nicommons-id').forEach((checkbox) => {
      if (checkbox.checked) checkedId.push(checkbox.value);
    });

    const nicommonsIdTextarea = document.getElementById(
      'nicommons-id-textarea'
    );
    nicommonsIdTextarea.value = checkedId.join(' ');
  };

  const nicommonsIdList = document.getElementById('nicommons-id-list');
  nicommonsIdList.innerHTML = null;

  for (const packageItem of packagesWithNicommonsId) {
    const [li, thumbnail, name, developer, type, nicommons] =
      makeLiFromArray(columns);

    const checkbox = li.getElementsByTagName('input')[0];
    checkbox.value = packageItem.info.nicommons;
    checkbox.checked = true;
    checkbox.addEventListener('change', updateTextarea);

    name.innerText = packageItem.info.name;
    developer.innerText = packageItem.info.originalDeveloper
      ? `${packageItem.info.developer}（オリジナル：${packageItem.info.originalDeveloper}）`
      : packageItem.info.developer;
    packageUtil.parsePackageType(packageItem.type).forEach((e) => {
      const typeItem = document.getElementById('tag-template').cloneNode(true);
      typeItem.removeAttribute('id');
      typeItem.innerText = e;
      type.appendChild(typeItem);
    });
    nicommons.innerText = packageItem.info.nicommons;

    const nicommonsData = await getNicommonsData(packageItem.info.nicommons);
    if (nicommonsData && 'node' in nicommonsData) {
      const img = document.createElement('img');
      img.src = nicommonsData.node.thumbnailURL.replace('size=l', 'size=s');
      img.classList.add('img-fluid');
      thumbnail.appendChild(img);
    }

    nicommonsIdList.appendChild(li);
  }

  updateTextarea();
}

const packageMain = {
  getPackages,
  setPackagesList,
  checkPackagesList,
  getScriptsList,
  installPackage,
  uninstallPackage,
  openPackageFolder,
  installScript,
  listFilter,
  displayNicommonsIdList,
};
export default packageMain;
