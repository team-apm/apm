const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const Store = require('electron-store');
const store = new Store();
const replaceText = require('../lib/replaceText');
const unzip = require('../lib/unzip');
const package = require('../package/package');
const setting = require('../setting/setting');
const buttonTransition = require('../lib/buttonTransition');
const parseXML = require('../lib/parseXML');
const apmJson = require('../lib/apmJson');
const mod = require('../lib/mod');

/**
 * Shows check date.
 */
function showCheckDate() {
  if (document.getElementById('core-check-date')) {
    if (store.has('checkDate.core')) {
      const checkDate = new Date(store.get('checkDate.core'));
      replaceText('core-check-date', checkDate.toLocaleString());
    } else {
      replaceText('core-check-date', '未確認');
    }
  }
}

// Functions to be exported

/**
 * Displays installed version.
 *
 * @param {string} instPath - An installation path.
 */
async function displayInstalledVersion(instPath) {
  const coreInfo = await this.getCoreInfo();
  if (coreInfo) {
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

      if (instPath && apmJson.has(instPath, 'core.' + program)) {
        if (filesCount === existCount) {
          replaceText(
            `${program}-installed-version`,
            apmJson.get(instPath, 'core.' + program, '未インストール')
          );
        } else {
          replaceText(
            `${program}-installed-version`,
            '未インストール（ファイルの存在が確認できませんでした。）'
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

  const modInfo = await mod.getInfo();
  if (modInfo) {
    replaceText('core-mod-date', modInfo.core.toLocaleString());
  } else {
    replaceText('core-mod-date', '未取得');
  }

  showCheckDate();
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
    } catch {
      return null;
    }
  } else {
    return false;
  }
}

/**
 * Sets versions of each program in selects.
 */
async function setCoreVersions() {
  const aviutlVersionSelect = document.getElementById('aviutl-version-select');
  const exeditVersionSelect = document.getElementById('exedit-version-select');
  while (aviutlVersionSelect.childElementCount > 1) {
    aviutlVersionSelect.removeChild(aviutlVersionSelect.lastChild);
  }
  while (exeditVersionSelect.childElementCount > 1) {
    exeditVersionSelect.removeChild(exeditVersionSelect.lastChild);
  }

  const coreInfo = await this.getCoreInfo();
  if (coreInfo) {
    for (const program of ['aviutl', 'exedit']) {
      const progInfo = coreInfo[program];
      replaceText(`${program}-latest-version`, progInfo.latestVersion);

      for (const version of Object.keys(progInfo.releases)) {
        const option = document.createElement('option');
        option.value = version;
        option.innerText =
          version +
          (version.includes('rc') ? '（テスト版）' : '') +
          (version === progInfo.latestVersion ? '（最新版）' : '');

        if (program === 'aviutl') {
          aviutlVersionSelect.appendChild(option);
        } else if (program === 'exedit') {
          exeditVersionSelect.appendChild(option);
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
 * @param {HTMLButtonElement} btn - A HTMLElement of button element.
 * @param {string} instPath - An installation path.
 */
async function checkLatestVersion(btn, instPath) {
  const enableButton = buttonTransition.loading(btn);

  try {
    await ipcRenderer.invoke(
      'download',
      setting.getCoreDataUrl(),
      true,
      'core'
    );
    await mod.downloadData();
    store.set('checkDate.core', Date.now());
    await this.displayInstalledVersion(instPath);
    await this.setCoreVersions();
  } catch (e) {
    buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
    setTimeout(() => {
      enableButton();
    }, 3000);
    throw e;
  }

  buttonTransition.message(btn, '更新完了', 'success');
  setTimeout(() => {
    enableButton();
  }, 3000);
  showCheckDate();
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
    store.set('installationPath', selectedPath[0]);
    await this.displayInstalledVersion(selectedPath[0]);
    await package.setPackagesList(selectedPath[0]);
    input.value = selectedPath[0];
  }
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

  if (!version) {
    buttonTransition.message(btn, 'バージョンを指定してください。', 'danger');
    setTimeout(() => {
      enableButton();
    }, 3000);
    throw new Error('A version is not selected.');
  }

  const coreInfo = await this.getCoreInfo();

  if (coreInfo) {
    try {
      const url = coreInfo[program].releases[version];
      const archivePath = await ipcRenderer.invoke(
        'download',
        url,
        true,
        'core'
      );
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
        await this.displayInstalledVersion(instPath);

        buttonTransition.message(btn, 'インストール完了', 'success');
      } else {
        buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
      }
    } catch {
      buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
    }
  } else {
    buttonTransition.message(btn, 'バージョンデータが存在しません。', 'danger');
  }

  setTimeout(() => {
    enableButton();
  }, 3000);
}

module.exports = {
  displayInstalledVersion,
  getCoreInfo,
  setCoreVersions,
  checkLatestVersion,
  selectInstallationPath,
  installProgram,
};
