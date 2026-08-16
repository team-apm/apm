import { Scripts } from 'apm-schema';
import log from 'electron-log/renderer';
import {
  copy,
  existsSync,
  mkdir,
  readdir,
  readJson,
  rename,
  rm,
} from 'fs-extra';
import { ListItem } from 'list.js';
import * as matcher from 'matcher';
import { execSync } from 'node:child_process';
import path from 'node:path';
import ApmJson from '../../lib/ApmJson';
import * as buttonTransition from '../../lib/buttonTransition';
import { getConfig } from '../../lib/Config';
import {
  app,
  clipboardWriteText,
  download,
  getNicommonsData,
  openBrowser,
  openPath,
  openYesNoDialog,
} from '../../lib/ipcWrapper';
import * as modList from '../../lib/modList';
import * as parseJson from '../../lib/parseJson';
import replaceText from '../../lib/replaceText';
import createList, { UpdatableList } from '../../lib/updatableList';
import { compareVersion } from '../../shared/compareVersion';
import { getHash } from '../../shared/getHash';
import { checkIntegrity, verifyFile } from '../../shared/integrity';
import { safeRemove } from '../../shared/safeRemove';
import unzip from '../../shared/unzip';
import { PackageItem } from '../../types/packageItem';
import { install, programs, programsDisp, verifyFilesByCount } from './common';
import packageUtil from './packageUtil';

const config = getConfig();

// To avoid a bug in the library
// https://github.com/sindresorhus/matcher/issues/32
const isMatch = (
  input: string | readonly string[],
  pattern: readonly string[],
) => pattern.some((p) => matcher.isMatch(input, p));

let selectedEntry: PackageItem | Scripts['webpage'][number];
let selectedEntryType: string;
const entryType = { package: 'package', scriptSite: 'script' };
let listJS: UpdatableList;
const shareStringVersion = '1.0';

/**
 * Get the date today
 * @returns {string} Today's date
 */
function getDate() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(
    2,
    '0',
  )}/${String(d.getDate()).padStart(2, '0')}`;
}

// Functions to be exported

/**
 * Get packages
 * @param {string} instPath - An installation path
 * @returns {Promise.<object[]>} An object of packages
 */
async function getPackages(instPath: string) {
  return await packageUtil.getPackages(modList.getPackagesDataUrl(instPath));
}

/**
 * Sets rows of each package in the table.
 * @param {string} instPath - An installation path.
 */
async function setPackagesList(instPath: string) {
  const packagesSort = document.getElementById('packages-sort');
  const packagesList = document.getElementById('packages-list');
  const packagesList2 = document.getElementById('packages-list2');
  packagesList2.innerHTML = null;

  const columns = [
    'packageID',
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
    'ID',
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
          .cloneNode(true) as HTMLButtonElement;
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
  const packagesExtra = await packageUtil.getPackagesExtra(packages, instPath);
  manuallyInstalledFiles = packagesExtra.manuallyInstalledFiles;
  packages = packagesExtra.packages;

  const apmJson = await ApmJson.load(instPath);

  // guess which packages are installed from integrity
  let modified = false;
  apmJson.begin();
  for (const p of packages.filter(
    (p) =>
      p.info.releases &&
      p.installationStatus === packageUtil.states.manuallyInstalled,
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
    const packagesExtraMod = await packageUtil.getPackagesExtra(
      packages,
      instPath,
    );
    manuallyInstalledFiles = packagesExtraMod.manuallyInstalledFiles;
    packages = packagesExtraMod.packages;
  }

  packages = await packageUtil.getPackagesStatus(instPath, packages);

  // show the package list
  const makeLiFromArray = (columnList: string[]) => {
    const li = document
      .getElementById('list-template')
      .cloneNode(true) as HTMLLIElement;
    li.removeAttribute('id');
    const result: { li: HTMLLIElement; [key: string]: HTMLElement } = {
      li: li,
    };
    columnList.forEach(
      (tdName) =>
        (result[tdName] = li.getElementsByClassName(tdName)[0] as HTMLElement),
    );
    return result;
  };

  packagesList.innerHTML = null;

  for (const packageItem of packages.filter(
    (p) =>
      !(
        p.info.isHidden &&
        p.installationStatus === packageUtil.states.notInstalled
      ),
  )) {
    const {
      li,
      packageID,
      name,
      developer,
      type,
      overview,
      description,
      pageURL,
      latestVersion,
      dependencyInformation,
      statusInformation,
      installationStatus,
    } = makeLiFromArray([...columns, 'statusInformation']) as {
      li: HTMLLIElement;
      packageID: HTMLDivElement;
      name: HTMLHeadingElement;
      developer: HTMLDivElement;
      type: HTMLDivElement;
      overview: HTMLDivElement;
      description: HTMLDivElement;
      pageURL: HTMLAnchorElement;
      latestVersion: HTMLDivElement;
      dependencyInformation: HTMLDivElement;
      statusInformation: HTMLDivElement;
      installationStatus: HTMLDivElement;
    };
    li.addEventListener('click', () => {
      selectedEntry = packageItem;
      selectedEntryType = entryType.package;
      li.getElementsByTagName('input')[0].checked = true;
      for (const tmpli of Array.from(packagesList.getElementsByTagName('li'))) {
        tmpli.classList.remove('list-group-item-light');
      }
      li.classList.add('list-group-item-light');
      document.getElementById('install-package').innerText =
        installationStatus.innerText.startsWith('インストール済み')
          ? '　　更新　　'
          : 'インストール';
    });
    packageID.innerText = packageItem.id;
    name.innerText = packageItem.info.name;
    overview.innerText = packageItem.info.overview;
    developer.innerText = packageItem.info.originalDeveloper
      ? `${packageItem.info.developer}（オリジナル：${packageItem.info.originalDeveloper}）`
      : packageItem.info.developer;
    packageUtil.parsePackageType(packageItem.type).forEach((e) => {
      const typeItem = document
        .getElementById('tag-template')
        .cloneNode(true) as HTMLSpanElement;
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
          Array.from(
            new Set(
              ids
                .split('|')
                .map((id) => packages.find((p) => p.id === id)?.info?.name),
            ),
          ).join(' or '),
        )
        .flatMap((text) => (text ? ['🔗 ' + text] : []))
        .join(' ') ?? '';
    statusInformation.innerText = null;
    packageItem.detached.forEach((p) => {
      const aTag = document.createElement('a');
      aTag.href = '#';
      aTag.classList.add('text-danger');
      aTag.innerText = `要導入: ${p.info.name}\r\n`;
      statusInformation.appendChild(aTag);
      aTag.addEventListener('click', async () => {
        await installPackage(instPath, p);
        return false;
      });
    });
    const verText = document.createElement('div');
    verText.classList.add('text-warning');
    verText.innerText = packageItem.doNotInstall ? 'インストール不可\r\n' : '';
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
    const {
      li,
      name,
      developer,
      type,
      overview,
      description,
      pageURL,
      latestVersion,
      dependencyInformation,
      statusInformation,
      installationStatus,
    } = makeLiFromArray([...columns, 'statusInformation']) as {
      li: HTMLLIElement;
      name: HTMLHeadingElement;
      developer: HTMLDivElement;
      type: HTMLDivElement;
      overview: HTMLDivElement;
      description: HTMLDivElement;
      pageURL: HTMLAnchorElement;
      latestVersion: HTMLDivElement;
      dependencyInformation: HTMLDivElement;
      statusInformation: HTMLDivElement;
      installationStatus: HTMLDivElement;
    };
    li.addEventListener('click', () => {
      selectedEntry = webpage;
      selectedEntryType = entryType.scriptSite;
      li.getElementsByTagName('input')[0].checked = true;
      for (const tmpli of Array.from(packagesList.getElementsByTagName('li'))) {
        tmpli.classList.remove('list-group-item-light');
      }
      li.classList.add('list-group-item-light');
      replaceText('install-package', 'インストール');
    });
    name.innerText = webpage.developer;
    overview.innerText = '配布サイトからスクリプトをインストール';
    developer.innerText = webpage.developer;
    const typeItem = document
      .getElementById('tag-template')
      .cloneNode(true) as HTMLSpanElement;
    typeItem.removeAttribute('id');
    typeItem.classList.replace(
      'list-group-item-light',
      'list-group-item-success',
    );
    typeItem.innerText = 'スクリプト配布サイト';
    type.appendChild(typeItem);
    latestVersion.innerText = '';
    installationStatus.innerText = '';
    description.innerText = webpage?.description ?? '';
    pageURL.innerText = webpage.url;
    pageURL.href = webpage.url;
    dependencyInformation.innerText = '';
    statusInformation.innerText = '';

    packagesList.appendChild(li);
  }

  // sorting and filtering
  const searchRegex =
    /^.*🍎[\u{fe0e}\u{fe0f}]?([A-Za-z0-9.]+):([A-Za-z0-9.]+),🎞[\u{fe0e}\u{fe0f}]?([A-Za-z0-9.]+),🎬[\u{fe0e}\u{fe0f}]?([A-Za-z0-9.]+)((,[A-Za-z0-9]+\/[A-Za-z0-9]+)*)$/u;
  // Variation Selectors for text (U+FE0E) or color (U+FE0F) are added to 🍎, 🎞 and 🎬.
  const searchFunction: UpdatableList['searchFunction'] = (
    items: { values: () => { packageID?: string }; found?: boolean }[],
    searchString,
  ) => {
    items.forEach((item) => (item.found = false));
    const searchStringArray = searchString.toLowerCase().match(searchRegex);
    const searchVersions = {
      share: searchStringArray[1],
      apm: searchStringArray[2],
      aviutl: searchStringArray[3],
      exedit: searchStringArray[4],
      packages: searchStringArray[5].split(',').slice(1),
    };
    searchVersions.packages.forEach((id) => {
      const foundItem = items.find(
        (item) => item.values().packageID.toLowerCase() === id,
      );
      if (foundItem) foundItem.found = true;
    });
    return (async () => {
      const alertStrings = [];
      if (compareVersion(shareStringVersion, searchVersions.share) < 0)
        alertStrings.push(
          '新しいバージョンのapmに対応したデータです。正しく読み込むためにapmの更新が必要な場合があります。',
        );
      for (const program of programs) {
        const currentVersion = (await apmJson.get('core.' + program)) as string;
        const comparison = compareVersion(
          currentVersion,
          searchVersions[program],
        );
        if (Number.isNaN(comparison))
          alertStrings.push(
            `${programsDisp[program]} ${searchVersions[program]} 用のデータです。使用中の ${programsDisp[program]} ${currentVersion} と互換性があるか確認できませんでした。`,
          );
        else if (comparison !== 0)
          alertStrings.push(
            `${programsDisp[program]} ${searchVersions[program]} 用のデータです。使用中の ${programsDisp[program]} ${currentVersion} には非対応の場合があります。`,
          );
      }
      return alertStrings.join('\n');
    })();
  };

  if (typeof listJS === 'undefined') {
    listJS = createList(
      'packages',
      {
        regex: searchRegex,
        searchFunction: searchFunction,
      },
      {
        valueNames: columns,
        fuzzySearch: { distance: 10000 }, // Ensure that searches are performed even on long strings.
      },
    );
  } else {
    listJS.reIndex();
    listJS.update(searchFunction);
  }

  // list manually added packages
  for (const ef of manuallyInstalledFiles) {
    const {
      li,
      name,
      developer,
      type,
      overview,
      latestVersion,
      installationStatus,
    } = makeLiFromArray(columns) as {
      li: HTMLLIElement;
      name: HTMLHeadingElement;
      developer: HTMLDivElement;
      type: HTMLDivElement;
      overview: HTMLDivElement;
      latestVersion: HTMLDivElement;
      installationStatus: HTMLDivElement;
    };
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
  [...batchInstallElm.getElementsByClassName('batch-install-package')].map(
    (e) => e.remove(),
  );
  packages
    .filter((p) => p.info.directURL)
    .map((p) => {
      const liTag = document
        .getElementById('batch-install-package-template')
        .cloneNode(true) as HTMLSpanElement;
      liTag.removeAttribute('id');
      (liTag.getElementsByClassName('name')[0] as HTMLElement).innerText =
        p.info.name;
      (
        liTag.getElementsByClassName('installed-version')[0] as HTMLElement
      ).innerText = p.installationStatus;
      return liTag;
    })
    .forEach((e) => batchInstallElm.appendChild(e));

  // settings page
  if (config.modDate.hasPackages()) {
    const modDate = new Date(config.modDate.getPackages());
    replaceText('packages-mod-date', modDate.toLocaleString());

    const checkDate = new Date(config.checkDate.getPackages());
    replaceText('packages-check-date', checkDate.toLocaleString());
  } else {
    replaceText('packages-mod-date', '未取得');

    replaceText('packages-check-date', '未確認');
  }
}

/**
 * Checks the packages list.
 * @param {string} instPath - An installation path.
 */
async function checkPackagesList(instPath: string) {
  const btn = document.getElementById(
    'check-packages-list',
  ) as HTMLButtonElement;
  const enableButton = btn
    ? buttonTransition.loading(btn, '更新').enableButton
    : undefined;

  const overlay = document.getElementById('packages-table-overlay');
  if (overlay) {
    overlay.style.zIndex = '1000';
    overlay.classList.add('show');
  }

  try {
    await modList.updateInfo();
    await packageUtil.downloadRepository(modList.getPackagesDataUrl(instPath));
    config.checkDate.setPackages(Date.now());
    const modInfo = await modList.getInfo();
    config.modDate.setPackages(
      Math.max(...modInfo.packages.map((p) => new Date(p.modified).getTime())),
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
    overlay.style.zIndex = '-1';
  }

  if (btn) {
    setTimeout(() => {
      enableButton();
    }, 3000);
  }
}

/**
 * Checks the scripts list.
 * @param {boolean} update - Download the json file.
 * @returns {Promise<Scripts>} - An object parsed from scripts.json.
 */
async function getScriptsList(update = false) {
  const dictUrl = await modList.getScriptsDataUrl();
  const result: { webpage: Scripts['webpage']; scripts: Scripts['scripts'] } = {
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
    const json: Scripts = await readJson(scriptsJson);
    result.webpage = result.webpage.concat(json.webpage);
    result.scripts = result.scripts.concat(json.scripts);
  }

  if (update) {
    const currentMod = await modList.getInfo();
    config.modDate.setScripts(
      Math.max(
        ...currentMod.scripts.map((p) => new Date(p.modified).getTime()),
      ),
    );
  }

  return result;
}

/**
 * Installs a package to installation path.
 * @param {string} instPath - An installation path.
 * @param {object} [packageToInstall] - A package to install.
 * @param {boolean} [direct] - Install from the direct link to the zip.
 * @param {string} [strArchivePath] - Path to the downloaded archive.
 */
async function installPackage(
  instPath: string,
  packageToInstall?: PackageItem,
  direct = false,
  strArchivePath?: string,
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
    await installScript(instPath);
    return;
  }

  const btn = document.getElementById('install-package') as HTMLButtonElement;
  const { enableButton } = btn
    ? buttonTransition.loading(btn, 'インストール')
    : { enableButton: null };

  if (!instPath) {
    log.error('An installation path is not selected.');
    if (btn) {
      buttonTransition.message(
        btn,
        'インストール先フォルダを指定してください。',
        'danger',
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
    return;
  }

  let installedPackage: PackageItem;

  if (packageToInstall) {
    installedPackage = { ...packageToInstall };
  } else {
    if (!selectedEntry) {
      log.error('A package to install is not selected.');
      if (btn) {
        buttonTransition.message(
          btn,
          'プラグインまたはスクリプトを選択してください。',
          'danger',
        );
        setTimeout(() => {
          enableButton();
        }, 3000);
      }
      return;
    }

    if ((selectedEntry as PackageItem).id?.startsWith('script_')) {
      log.error('This script cannot be overwritten.');
      if (btn) {
        buttonTransition.message(
          btn,
          'このスクリプトは上書きインストールできません。',
          'danger',
        );
        setTimeout(() => {
          enableButton();
        }, 3000);
      }
      return;
    }

    installedPackage = { ...selectedEntry } as PackageItem;
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
          'danger',
        );
        setTimeout(() => {
          enableButton();
        }, 3000);
      }
      return;
    }

    const integrityForArchive = installedPackage.info.releases?.find(
      (r) => r.version === installedPackage.info.latestVersion,
    )?.integrity?.archive;

    if (integrityForArchive) {
      // Verify file integrity
      while (!(await verifyFile(archivePath, integrityForArchive))) {
        const dialogResult = await openYesNoDialog(
          'エラー',
          'ダウンロードされたファイルは破損しています。再ダウンロードしますか？',
        );

        if (!dialogResult) {
          log.error(
            `The downloaded archive file is corrupt. URL:${installedPackage.info.directURL}`,
          );
          if (btn) {
            buttonTransition.message(
              btn,
              'ダウンロードされたファイルは破損しています。',
              'danger',
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
            `Failed downloading the archive file. URL:${installedPackage.info.directURL}`,
          );
          if (btn) {
            buttonTransition.message(
              btn,
              'ファイルのダウンロードに失敗しました。',
              'danger',
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
      'package',
    );

    if (!downloadResult) {
      log.info('The installation was canceled.');
      if (btn) {
        buttonTransition.message(
          btn,
          'インストールがキャンセルされました。',
          'info',
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
          installedPackage.id,
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

    if (installedPackage.info.installer) {
      const searchFiles = async (dirName: string) => {
        let result: string[][] = [];
        const dirents = await readdir(dirName, {
          withFileTypes: true,
        });
        for (const dirent of dirents) {
          if (dirent.isDirectory()) {
            const childResult = await searchFiles(
              path.join(dirName, dirent.name),
            );
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

      const exePath = await searchFiles(unzippedPath);
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
        installedPackage.info.files,
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
    const apmJson = await ApmJson.load(instPath);
    await apmJson.addPackage(
      installedPackage.id,
      installedPackage.info.latestVersion,
    );
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
 * @param {string} instPath - An installation path.
 */
async function uninstallPackage(instPath: string) {
  const btn = document.getElementById('uninstall-package') as HTMLButtonElement;
  const { enableButton } = buttonTransition.loading(btn, 'アンインストール');

  if (selectedEntryType !== entryType.package) {
    log.error('A package to install is not selected.');
    buttonTransition.message(
      btn,
      'プラグインまたはスクリプトを選択してください。',
      'danger',
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
      'danger',
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
      'danger',
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  const uninstalledPackage = { ...selectedEntry } as PackageItem;

  const filesToRemove = [];
  for (const file of uninstalledPackage.info.files) {
    if (!file.isInstallOnly)
      filesToRemove.push(path.join(instPath, file.filename));
  }

  try {
    await Promise.all(
      filesToRemove.map((filePath) => safeRemove(filePath, instPath)),
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

  const apmJson = await ApmJson.load(instPath);
  await apmJson.removePackage(uninstalledPackage.id);
  if (filesCount === notExistCount) {
    if (!uninstalledPackage.id.startsWith('script_')) {
      await setPackagesList(instPath);
      await displayNicommonsIdList(instPath);
    } else {
      await parseJson.removePackage(
        modList.getLocalPackagesDataUrl(instPath),
        uninstalledPackage,
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
  const btn = document.getElementById(
    'open-package-folder',
  ) as HTMLButtonElement;
  const { enableButton } = buttonTransition.loading(
    btn,
    'ダウンロードフォルダ',
  );

  if (selectedEntryType !== entryType.package) {
    log.error('A package to install is not selected.');
    buttonTransition.message(
      btn,
      'プラグインまたはスクリプトを選択してください。',
      'danger',
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
      'danger',
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  const exists = await openPath(`package/${(selectedEntry as PackageItem).id}`);

  if (!exists) {
    log.error('The package has not been downloaded.');
    buttonTransition.message(
      btn,
      'このパッケージはダウンロードされていません。',
      'danger',
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
 * @param {string} instPath - An installation path.
 */
async function installScript(instPath: string) {
  const btn = document.getElementById('install-package') as HTMLButtonElement;
  const { enableButton } = buttonTransition.loading(btn);
  const url = (selectedEntry as Scripts['webpage'][number]).url;

  if (!instPath) {
    log.error('An installation path is not selected.');
    buttonTransition.message(
      btn,
      'インストール先フォルダを指定してください。',
      'danger',
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
      'info',
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

  if ('redirect' in matchInfo) {
    // Determine which of the redirections can be installed and install them.
    let packages = await getPackages(instPath);
    packages = (await packageUtil.getPackagesExtra(packages, instPath))
      .packages;
    packages = await packageUtil.getPackagesStatus(instPath, packages);
    const packageId = matchInfo.redirect
      .split('|')
      .find((candidate: string) =>
        packages.find((p) => p.id === candidate && p.doNotInstall !== true),
      );
    if (packageId) {
      await installPackage(
        instPath,
        packages.find((p) => p.id === packageId),
        undefined,
        archivePath,
      );
    } else {
      buttonTransition.message(
        btn,
        '指定されたパッケージは存在しません。',
        'danger',
      );
    }
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

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
    const dirents = await readdir(dirName, {
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
    const dirents = await readdir(dirName, {
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
      buttonTransition.message(btn, 'スクリプトが含まれていません。', 'danger');
      setTimeout(() => {
        enableButton();
      }, 3000);
      return;
    }
    if (await extExists(unzippedPath, pluginExtRegex)) {
      log.error('Plugin files are included.');
      buttonTransition.message(
        btn,
        'プラグインが含まれているためインストールできません。',
        'danger',
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
    const scriptRoot = (await searchScriptRoot(unzippedPath))[0];
    const entriesToCopy = (
      await readdir(scriptRoot, {
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

    await parseJson.addPackage(
      modList.getLocalPackagesDataUrl(instPath),
      packageItem,
    );
    const apmJson = await ApmJson.load(instPath);
    await apmJson.addPackage(packageItem.id, packageItem.latestVersion);
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

const filterButtons: Set<HTMLButtonElement> = new Set();
/**
 * Filter the list.
 * @param {string} column - A column name to filter
 * @param {HTMLCollection} btns - A list of buttons
 * @param {HTMLButtonElement} btn - A button selected
 */
function listFilter(
  column: string,
  btns: HTMLCollectionOf<HTMLButtonElement>,
  btn: HTMLButtonElement,
) {
  const isClear =
    btn.classList.contains('selected') || btn.dataset.installFilter === 'clear';

  for (const element of Array.from(btns)) {
    filterButtons.add(element);
  }
  for (const element of Array.from(filterButtons)) {
    element.classList.remove('selected');
  }

  if (isClear) {
    listJS.filter();
    listJS.update();
  } else {
    let filterFunc;
    if (column === 'type') {
      const query = packageUtil.parsePackageType([btn.dataset.typeFilter]);
      filterFunc = (item: ListItem) => {
        if (
          query.some((q) =>
            (item.values() as { type: string }).type.includes(q),
          )
        ) {
          return true;
        } else {
          return false;
        }
      };
    } else if (column === 'installationStatus') {
      const query = btn.dataset.installFilter;
      const getValue = (item: ListItem) => {
        return (item.values() as { installationStatus: string })
          .installationStatus;
      };
      if (query === 'true') {
        filterFunc = (item: ListItem) => {
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
        filterFunc = (item: ListItem) => {
          const value = getValue(item);
          if (value === packageUtil.states.manuallyInstalled) {
            return true;
          } else {
            return false;
          }
        };
      } else if (query === 'false') {
        filterFunc = (item: ListItem) => {
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
 * @param {string} instPath - An installation path.
 */
async function displayNicommonsIdList(instPath: string) {
  const packages = await getPackages(instPath);
  type PackageItemWithNicommonsId = {
    info: {
      name: string;
      developer: string;
      originalDeveloper?: string;
      nicommons: string;
    };
    type: string[];
  };

  const asyncFilter = async <T>(
    array: T[],
    predicate: (value: T, index: number, array: T[]) => Promise<unknown>,
  ) => {
    const bits = await Promise.all(array.map(predicate));
    return array.filter((_, i) => bits[i]);
  };

  const apmJson = await ApmJson.load(instPath);

  const packagesWithNicommonsId: [
    PackageItemWithNicommonsId,
    PackageItemWithNicommonsId,
    ...PackageItem[],
  ] = [
    {
      info: { name: 'AviUtl', developer: 'KENくん', nicommons: 'im1696493' },
      type: [] as never[],
    },
    {
      info: {
        name: 'AviUtl Package Manager',
        developer: 'Team apm',
        nicommons: 'nc251912',
      },
      type: [] as never[],
    },
    ...(await asyncFilter(
      packages,
      async (value) =>
        (await apmJson.has('packages.' + value.id)) && value.info.nicommons,
    )),
  ];

  // show the package list
  const columns = ['thumbnail', 'name', 'developer', 'type', 'nicommons'];
  const makeLiFromArray = (columnList: string[]) => {
    const li = document
      .getElementById('nicommons-id-template')
      .cloneNode(true) as HTMLLIElement;
    li.removeAttribute('id');
    const result: { li: HTMLLIElement; [key: string]: HTMLElement } = {
      li: li,
    };
    columnList.forEach(
      (tdName) =>
        (result[tdName] = li.getElementsByClassName(tdName)[0] as HTMLElement),
    );
    return result;
  };

  const updateTextarea = () => {
    const checkedId: string[] = [];
    Array.from(
      document.getElementsByName(
        'nicommons-id',
      ) as NodeListOf<HTMLInputElement>,
    ).forEach((checkbox) => {
      if (checkbox.checked) checkedId.push(checkbox.value);
    });

    const nicommonsIdTextarea = document.getElementById(
      'nicommons-id-textarea',
    ) as HTMLTextAreaElement;
    nicommonsIdTextarea.value = checkedId.join(' ');
  };

  const nicommonsIdList = document.getElementById('nicommons-id-list');
  nicommonsIdList.innerHTML = null;

  for (const packageItem of packagesWithNicommonsId) {
    const { li, thumbnail, name, developer, type, nicommons } = makeLiFromArray(
      columns,
    ) as {
      li: HTMLLIElement;
      thumbnail: HTMLDivElement;
      name: HTMLHeadingElement;
      developer: HTMLDivElement;
      type: HTMLDivElement;
      nicommons: HTMLDivElement;
    };

    const checkbox = li.getElementsByTagName('input')[0];
    checkbox.value = packageItem.info.nicommons;
    checkbox.checked = true;
    checkbox.addEventListener('change', updateTextarea);

    name.innerText = packageItem.info.name;
    developer.innerText = packageItem.info.originalDeveloper
      ? `${packageItem.info.developer}（オリジナル：${packageItem.info.originalDeveloper}）`
      : packageItem.info.developer;
    packageUtil.parsePackageType(packageItem.type).forEach((e) => {
      const typeItem = document
        .getElementById('tag-template')
        .cloneNode(true) as HTMLSpanElement;
      typeItem.removeAttribute('id');
      typeItem.innerText = e;
      type.appendChild(typeItem);
    });
    nicommons.innerText = packageItem.info.nicommons;

    const nicommonsData = (await getNicommonsData(
      packageItem.info.nicommons,
    )) as { [key: string]: { [key: string]: string } };
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

/**
 * Returns a nicommonsID list separated by space.
 * @param {string} instPath - An installation path.
 */
async function sharePackages(instPath: string) {
  const btn = document.getElementById('share-packages') as HTMLButtonElement;
  const { enableButton } = btn
    ? buttonTransition.loading(btn, '共有')
    : { enableButton: null };

  const ver = {
    share: shareStringVersion, // version of this data
    apm: await app.getVersion(),
    aviutl: '',
    exedit: '',
    packages: [''],
  };

  const apmJson = await ApmJson.load(instPath);

  for (const program of programs) {
    const currentVersion = (await apmJson.get('core.' + program)) as string;
    ver[program] = currentVersion;
  }
  ver.packages = (
    await packageUtil.getPackagesExtra(await getPackages(instPath), instPath)
  ).packages
    .filter(
      (p) =>
        p.installationStatus === packageUtil.states.installed ||
        p.installationStatus === packageUtil.states.manuallyInstalled,
    )
    .map((p) => p.id)
    .filter((id) => id.includes('/'))
    .sort((a, b) => {
      const compare = (a: string, b: string) => (a > b ? 1 : a < b ? -1 : 0);
      const a2 = a.split('/');
      const b2 = b.split('/');
      return a2[0] === b2[0] ? compare(a2[1], b2[1]) : compare(a2[0], b2[0]);
    });
  await clipboardWriteText(
    //  Variation Selectors: 🍎️(color), 🎞︎(text), 🎬︎(text)
    `ここにタイトルを入力🍎️${ver.share}:${ver.apm},🎞︎${ver.aviutl},🎬︎${
      ver.exedit
    },${ver.packages.join(',')}`,
  );

  buttonTransition.message(btn, 'コピーしました', 'info');
  if (btn) {
    setTimeout(() => {
      enableButton();
    }, 3000);
  }
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
  sharePackages,
};
export default packageMain;
