const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const Store = require('electron-store');
const store = new Store();
const log = require('electron-log');
const replaceText = require('../lib/replaceText');
const unzip = require('../lib/unzip');
const shortcut = require('../lib/shortcut');
const package = require('../package/package');
const packageUtil = require('../package/packageUtil');
const setting = require('../setting/setting');
const buttonTransition = require('../lib/buttonTransition');
const parseXML = require('../lib/parseXML');
const apmJson = require('../lib/apmJson');
const mod = require('../lib/mod');
const integrity = require('../lib/integrity');
const migration = require('../migration/migration1to2');
const { convertId } = require('../lib/convertId');

// Functions to be exported

/**
 * Initializes core
 *
 */
async function initCore() {
  if (!store.has('installationPath')) {
    const instPath = path.join(
      await ipcRenderer.invoke('app-get-path', 'home'),
      'aviutl'
    );
    store.set('installationPath', instPath);
    if (!fs.existsSync(instPath)) fs.mkdirSync(instPath);
  }
}

/**
 * Displays installed version.
 *
 * @param {string} instPath - An installation path.
 */
async function displayInstalledVersion(instPath) {
  const coreInfo = await getCoreInfo();
  if (instPath && coreInfo) {
    for (const program of ['aviutl', 'exedit']) {
      let filesCount = 0;
      let existCount = 0;
      for (const file of coreInfo[program].files) {
        if (!file.isOptional) {
          filesCount++;
          if (fs.existsSync(path.join(instPath, file.filename))) {
            existCount++;
          }
        }
      }

      // Set the version of the manually installed program
      if (!apmJson.has(instPath, 'core.' + program)) {
        for (const [version, release] of Object.entries(
          coreInfo[program].releases
        )) {
          if (await integrity.checkIntegrity(instPath, release.integrities))
            apmJson.setCore(instPath, program, version);
        }
      }

      if (apmJson.has(instPath, 'core.' + program)) {
        if (filesCount === existCount) {
          replaceText(
            `${program}-installed-version`,
            apmJson.get(instPath, 'core.' + program, '未インストール')
          );
        } else {
          replaceText(
            `${program}-installed-version`,
            apmJson.get(instPath, 'core.' + program, '未インストール') +
              '（ファイルの存在が確認できませんでした。）'
          );
        }
      } else {
        if (filesCount === existCount) {
          replaceText(`${program}-installed-version`, '手動インストール済み');
        } else {
          replaceText(`${program}-installed-version`, '未インストール');
        }
      }
    }
  } else {
    for (const program of ['aviutl', 'exedit']) {
      replaceText(`${program}-installed-version`, '未取得');
    }
  }

  if (store.has('modDate.core')) {
    const modDate = new Date(store.get('modDate.core'));
    replaceText('core-mod-date', modDate.toLocaleString());

    const checkDate = new Date(store.get('checkDate.core'));
    replaceText('core-check-date', checkDate.toLocaleString());
  } else {
    replaceText('core-mod-date', '未取得');

    replaceText('core-check-date', '未確認');
  }

  // Add a shortcut to the Start menu
  if (process.platform === 'win32') {
    const appDataPath = await ipcRenderer.invoke('app-get-path', 'appData');
    const aviutlPath = path.join(instPath, 'aviutl.exe');
    if (fs.existsSync(aviutlPath)) {
      shortcut.addAviUtlShortcut(appDataPath, aviutlPath);
    } else {
      shortcut.removeAviUtlShortcut(appDataPath);
    }
  }
}

/**
 * Returns an object parsed from core.xml.
 *
 * @returns {Promise<object>} - An object parsed from core.xml.
 */
async function getCoreInfo() {
  const coreFile = await ipcRenderer.invoke(
    'exists-temp-file',
    'core/core.xml'
  );
  if (coreFile.exists) {
    try {
      return parseXML.getCore(coreFile.path);
    } catch (e) {
      log.error(e);
      return null;
    }
  } else {
    return false;
  }
}

/**
 * Sets versions of each program in selects.
 *
 * @param {string} instPath - An installation path.
 */
async function setCoreVersions(instPath) {
  const installAviutlBtn = document.getElementById('install-aviutl');
  const installExeditBtn = document.getElementById('install-exedit');
  const aviutlVersionSelect = document.getElementById('aviutl-version-select');
  const exeditVersionSelect = document.getElementById('exedit-version-select');
  while (aviutlVersionSelect.childElementCount > 0) {
    aviutlVersionSelect.removeChild(aviutlVersionSelect.lastChild);
  }
  while (exeditVersionSelect.childElementCount > 0) {
    exeditVersionSelect.removeChild(exeditVersionSelect.lastChild);
  }

  const coreInfo = await getCoreInfo();
  if (coreInfo) {
    for (const program of ['aviutl', 'exedit']) {
      const progInfo = coreInfo[program];
      replaceText(`${program}-latest-version`, progInfo.latestVersion);

      for (const version of Object.keys(progInfo.releases)) {
        const li = document.createElement('li');
        const anchor = document.createElement('a');
        anchor.classList.add('dropdown-item');
        anchor.href = '#';
        anchor.innerText =
          version +
          (version.includes('rc') ? '（テスト版）' : '') +
          (version === progInfo.latestVersion ? '（最新版）' : '');
        li.appendChild(anchor);

        if (program === 'aviutl') {
          anchor.addEventListener('click', async (event) => {
            await installProgram(installAviutlBtn, program, version, instPath);
          });
          aviutlVersionSelect.appendChild(li);
        } else if (program === 'exedit') {
          anchor.addEventListener('click', async (event) => {
            await installProgram(installExeditBtn, program, version, instPath);
          });
          exeditVersionSelect.appendChild(li);
        }
      }
    }
  } else {
    for (const program of ['aviutl', 'exedit']) {
      replaceText(`${program}-latest-version`, '未取得');
    }
  }
}

/**
 * Checks the latest versionof programs.
 *
 * @param {string} instPath - An installation path.
 */
async function checkLatestVersion(instPath) {
  const btn = document.getElementById('check-core-version');
  const enableButton = buttonTransition.loading(btn, '更新');

  try {
    await ipcRenderer.invoke(
      'download',
      setting.getCoreDataUrl(),
      false,
      'core'
    );
    await mod.downloadData();
    store.set('checkDate.core', Date.now());
    const modInfo = await mod.getInfo();
    store.set('modDate.core', modInfo.core.getTime());
    await displayInstalledVersion(instPath);
    await setCoreVersions(instPath);
  } catch (e) {
    buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
    setTimeout(() => {
      enableButton();
    }, 3000);
    log.error(e);
    return;
  }

  buttonTransition.message(btn, '更新完了', 'success');
  setTimeout(() => {
    enableButton();
  }, 3000);
}

/**
 * Shows a dialog to select installation path and set it.
 *
 * @param {HTMLInputElement} input - A HTMLElement of input.
 */
async function selectInstallationPath(input) {
  const originalPath = input.value;
  const selectedPath = await ipcRenderer.invoke(
    'open-dir-dialog',
    'インストール先フォルダを選択',
    originalPath
  );
  if (!selectedPath || selectedPath.length === 0) {
    await ipcRenderer.invoke(
      'open-err-dialog',
      'エラー',
      'インストール先フォルダを選択してください。'
    );
  } else if (selectedPath[0] != originalPath) {
    const instPath = selectedPath[0];
    await changeInstallationPath(instPath);
    input.value = instPath;
  }
}

/**
 * Change the installation path.
 *
 * @param {string} instPath - An installation path.
 */
async function changeInstallationPath(instPath) {
  store.set('installationPath', instPath);

  // update 1
  await mod.downloadData();
  const currentMod = await mod.getInfo();

  // migration
  await migration.byFolder(instPath);

  if (currentMod.convert) {
    const oldConvertMod = new Date(apmJson.get(instPath, 'convertMod', 0));
    if (oldConvertMod.getTime() < currentMod.convert.getTime()) {
      await convertId(instPath, currentMod.convert.getTime());
    }
  }

  // update 2
  const oldScriptsMod = new Date(store.get('modDate.scripts', 0));
  const oldCoreMod = new Date(store.get('modDate.core', 0));
  const oldPackagesMod = new Date(store.get('modDate.packages', 0));

  if (oldScriptsMod.getTime() < currentMod.scripts?.getTime()) {
    await package.getScriptsList(true, currentMod.scripts.getTime());
  }
  if (oldCoreMod.getTime() < currentMod.core.getTime()) {
    await checkLatestVersion(instPath);
  }
  if (oldPackagesMod.getTime() < currentMod.packages.getTime()) {
    await package.checkPackagesList(instPath);
  }

  // redraw
  await displayInstalledVersion(instPath);
  await setCoreVersions(instPath);
  await package.setPackagesList(instPath);
}

/**
 * Installs a program to installation path.
 *
 * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
 * @param {string} program - A program name to install.
 * @param {string} version - A version to install.
 * @param {string} instPath - An installation path.
 */
async function installProgram(btn, program, version, instPath) {
  const enableButton = btn ? buttonTransition.loading(btn) : null;

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

  if (!version) {
    if (btn) {
      buttonTransition.message(btn, 'バージョンを指定してください。', 'danger');
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
    log.error('A version is not selected.');
    return;
  }

  const coreInfo = await getCoreInfo();

  if (coreInfo) {
    const url = coreInfo[program].releases[version].url;
    let archivePath = await ipcRenderer.invoke('download', url, true, 'core');

    const integrityForArchive =
      coreInfo[program].releases[version]?.archiveIntegrity;

    if (integrityForArchive) {
      for (;;) {
        // Verify file integrity
        if (await integrity.verifyFile(archivePath, integrityForArchive)) {
          break;
        } else {
          const dialogResult = await ipcRenderer.invoke(
            'open-yes-no-dialog',
            'エラー',
            'ダウンロードされたファイルは破損しています。再ダウンロードしますか？'
          );
          if (dialogResult) {
            archivePath = await ipcRenderer.invoke(
              'download',
              url,
              false,
              'core'
            );
            continue;
          } else {
            log.error(`The downloaded archive file is corrupt. URL:${url}`);
            if (btn) {
              buttonTransition.message(
                btn,
                'ダウンロードされたファイルは破損しています。',
                'danger'
              );
              setTimeout(() => {
                enableButton();
              }, 3000);
              return;
            } else {
              // Throw an error if not executed from the UI.
              throw new Error('The downloaded archive file is corrupt.');
            }
          }
        }
      }
    }

    try {
      const unzippedPath = await unzip(archivePath);
      fs.copySync(unzippedPath, instPath);

      let filesCount = 0;
      let existCount = 0;
      for (const file of coreInfo[program].files) {
        if (!file.isOptional) {
          filesCount++;
          if (fs.existsSync(path.join(instPath, file.filename))) {
            existCount++;
          }
        }
      }

      if (filesCount === existCount) {
        apmJson.setCore(instPath, program, version);
        await displayInstalledVersion(instPath);
        await package.setPackagesList(instPath);

        if (btn) buttonTransition.message(btn, 'インストール完了', 'success');
      } else {
        if (btn)
          buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
      }
    } catch (e) {
      if (btn)
        buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
      log.error(e);
    }
  } else {
    if (btn)
      buttonTransition.message(
        btn,
        'バージョンデータが存在しません。',
        'danger'
      );
  }

  if (btn)
    setTimeout(() => {
      enableButton();
    }, 3000);
}

/**
 * Perform a batch installation.
 *
 * @param {string} instPath - An installation path.
 */
async function batchInstall(instPath) {
  const btn = document.getElementById('batch-install');
  const enableButton = buttonTransition.loading(btn, 'インストール');

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

  try {
    const coreInfo = await getCoreInfo();
    for (const program of ['aviutl', 'exedit']) {
      const progInfo = coreInfo[program];
      await installProgram(null, program, progInfo.latestVersion, instPath);
    }
    const allPackages = packageUtil.getPackagesExtra(
      await package.getPackages(instPath),
      instPath
    ).packages;
    const packages = allPackages.filter(
      (p) =>
        p.info.directURL &&
        p.installationStatus === packageUtil.states.notInstalled
    );
    for (const packageItem of packages) {
      await package.installPackage(instPath, packageItem, true);
    }

    buttonTransition.message(btn, 'インストール完了', 'success');
  } catch (e) {
    buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
    log.error(e);
  }

  setTimeout(() => {
    enableButton();
  }, 3000);
}

module.exports = {
  initCore,
  displayInstalledVersion,
  getCoreInfo,
  setCoreVersions,
  checkLatestVersion,
  selectInstallationPath,
  changeInstallationPath,
  installProgram,
  batchInstall,
};
