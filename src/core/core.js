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

module.exports = {
  /**
   * Displays installed version.
   *
   * @param {string} instPath - An installation path.
   */
  displayInstalledVersion: async function (instPath) {
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
  },

  /**
   * Returns an object parsed from core.xml.
   *
   * @returns {Promise<object>} - An object parsed from core.xml.
   */
  getCoreInfo: async function () {
    const coreFile = await ipcRenderer.invoke(
      'exists-temp-file',
      'core/core.xml'
    );
    if (coreFile.exists) {
      try {
        return parseXML.core(coreFile.path);
      } catch {
        return null;
      }
    } else {
      return false;
    }
  },

  /**
   * Sets versions of each program in selects.
   */
  setCoreVersions: async function () {
    const aviutlVersionSelect = document.getElementById(
      'aviutl-version-select'
    );
    const exeditVersionSelect = document.getElementById(
      'exedit-version-select'
    );
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
          option.setAttribute('value', version);
          option.innerHTML =
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
  },

  /**
   * Checks the latest versionof programs.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of button element.
   * @param {string} instPath - An installation path.
   */
  checkLatestVersion: async function (btn, instPath) {
    const enableButton = buttonTransition.loading(btn);

    await ipcRenderer.invoke(
      'download',
      setting.getCoreDataUrl(),
      true,
      'core'
    );
    await mod.downloadData();
    store.set('checkDate.core', Date.now());
    this.displayInstalledVersion(instPath);
    this.setCoreVersions();

    enableButton();
    showCheckDate();
  },

  /**
   * Shows a dialog to select installation path and set it.
   *
   * @param {HTMLInputElement} input - A HTMLElement of input.
   */
  selectInstallationPath: async function (input) {
    const originalPath = input.value;
    const selectedPath = await ipcRenderer.invoke(
      'open-dir-dialog',
      'インストール先フォルダを選択',
      input.innerText
    );
    if (!selectedPath || selectedPath.length === 0) {
      await ipcRenderer.invoke(
        'open-err-dialog',
        'エラー',
        'インストール先フォルダを選択してください。'
      );
    } else if (selectedPath[0] != originalPath) {
      store.set('installationPath', selectedPath[0]);
      this.displayInstalledVersion(selectedPath[0]);
      package.setPackagesList(selectedPath[0]);
      input.setAttribute('value', selectedPath[0]);
    }
  },

  /**
   * Installs a program to installation path.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
   * @param {string} program - A program name to install.
   * @param {string} version - A version to install.
   * @param {string} instPath - An installation path.
   */
  installProgram: async function (btn, program, version, instPath) {
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
          this.displayInstalledVersion(instPath);

          buttonTransition.message(btn, 'インストール完了', 'success');
        } else {
          buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
        }
      } catch {
        buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
      }
    } else {
      buttonTransition.message(
        btn,
        'バージョンデータが存在しません。',
        'danger'
      );
    }

    setTimeout(() => {
      enableButton();
    }, 3000);
  },
};
