const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const Store = require('electron-store');
const store = new Store();
const parser = require('fast-xml-parser');
const replaceText = require('../lib/replaceText');
const unzip = require('../lib/unzip');
const setting = require('../setting/setting');

module.exports = {
  /**
   * Returns a core xml URL.
   *
   * @returns {string} - A core xml URL.
   */
  getCoreXmlUrl: function () {
    const dataUrl = setting.getDataUrl();
    return path.join(dataUrl, 'core.xml');
  },

  /**
   * Displays installed version.
   *
   * @param {string} instPath - An installation path.
   */
  displayInstalledVersion: async function (instPath) {
    const coreInfo = await this.getCoreInfo();

    for (const program of ['aviutl', 'exedit']) {
      if (instPath) {
        let filesCount = 0;
        let existCount = 0;
        for (const file of coreInfo.core[0][program][0].files[0].file) {
          if (typeof file === 'string') {
            filesCount++;
            if (fs.existsSync(path.join(instPath, file))) {
              existCount++;
            }
          }
        }

        if (filesCount === existCount) {
          replaceText(
            `${program}-installed-version`,
            store.get('installedVersion.core.' + program, '未インストール')
          );
        } else {
          replaceText(
            `${program}-installed-version`,
            '未インストール（ファイルの存在が確認できませんでした。）'
          );
        }
      } else {
        replaceText(`${program}-installed-version`, '未インストール');
      }
    }
  },

  /**
   * Returns an object parsed from core.xml.
   *
   * @returns {object} - An object parsed from core.xml.
   */
  getCoreInfo: async function () {
    const coreFile = await ipcRenderer.invoke(
      'exists-temp-file',
      'core/core.xml'
    );
    if (coreFile.exists) {
      const xmlData = fs.readFileSync(coreFile.path, 'utf-8');
      let coreInfo = {};
      const valid = parser.validate(xmlData);
      if (valid === true) {
        const options = {
          attributeNamePrefix: '$',
          // attrNodeName: 'attr', // default is 'false'
          textNodeName: '_',
          ignoreAttributes: false,
          // ignoreNameSpace: false,
          // allowBooleanAttributes: false,
          parseNodeValue: false,
          parseAttributeValue: false,
          trimValues: true,
          // cdataTagName: '__cdata', // default is 'false'
          // cdataPositionChar: '\\c',
          // parseTrueNumberOnly: false,
          arrayMode: true, // "strict"
          // stopNodes: ['parse-me-as-string'],
        };
        // optional (it'll return an object in case it's not valid)
        coreInfo = parser.parse(xmlData, options);
      } else {
        throw valid;
      }
      return coreInfo;
    } else {
      throw new Error('The version file does not exist.');
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
        const progInfo = coreInfo.core[0][program][0];
        replaceText(`${program}-latest-version`, progInfo.latestVersion);

        for (const release of progInfo.releases[0].fileURL) {
          const option = document.createElement('option');
          option.setAttribute('value', release.$version);
          option.innerHTML = release.$version;

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
   */
  checkLatestVersion: async function (btn) {
    btn.setAttribute('disabled', '');
    const beforeHTML = btn.innerHTML;
    btn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>' +
      '<span class="visually-hidden">Loading...</span>';

    await ipcRenderer.invoke('download', this.getCoreXmlUrl(), true, 'core');
    this.setCoreVersions();

    btn.innerHTML = beforeHTML;
    btn.removeAttribute('disabled');
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
    btn.setAttribute('disabled', '');
    const beforeHTML = btn.innerHTML;
    btn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>' +
      '<span class="visually-hidden">Loading...</span>';

    if (!instPath) {
      if (btn.classList.contains('btn-primary')) {
        btn.classList.replace('btn-primary', 'btn-danger');
        setTimeout(() => {
          btn.classList.replace('btn-danger', 'btn-primary');
        }, 3000);
      }
      btn.innerHTML = 'インストール先フォルダを指定してください。';
      setTimeout(() => {
        btn.innerHTML = beforeHTML;
        btn.removeAttribute('disabled');
      }, 3000);
      throw new Error('An installation path is not selected.');
    }

    if (!version) {
      if (btn.classList.contains('btn-primary')) {
        btn.classList.replace('btn-primary', 'btn-danger');
        setTimeout(() => {
          btn.classList.replace('btn-danger', 'btn-primary');
        }, 3000);
      }
      btn.innerHTML = 'バージョンを指定してください。';
      setTimeout(() => {
        btn.innerHTML = beforeHTML;
        btn.removeAttribute('disabled');
      }, 3000);
      throw new Error('A version is not selected.');
    }

    const coreInfo = await this.getCoreInfo();
    const getUrl = () => {
      const progInfo = coreInfo.core[0][program][0];
      const prefix = progInfo.releases[0].$prefix;
      const fileUrl = Array.from(progInfo.releases[0].fileURL).find(
        (element) => element.$version === version
      );

      if (prefix) {
        return path.join(prefix, fileUrl._);
      } else {
        return fileUrl._;
      }
    };

    const url = getUrl();
    const archivePath = await ipcRenderer.invoke('download', url, true, 'core');
    const unzippedPath = await unzip(archivePath);
    fs.copySync(unzippedPath, instPath);

    let filesCount = 0;
    let existCount = 0;
    for (const file of coreInfo.core[0][program][0].files[0].file) {
      if (typeof file === 'string') {
        filesCount++;
        if (fs.existsSync(path.join(instPath, file))) {
          existCount++;
        }
      }
    }

    if (filesCount === existCount) {
      store.set('installedVersion.core.' + program, version);
      this.displayInstalledVersion(instPath);

      if (btn.classList.contains('btn-primary')) {
        btn.classList.replace('btn-primary', 'btn-success');
        setTimeout(() => {
          btn.classList.replace('btn-success', 'btn-primary');
        }, 3000);
      }
      btn.innerHTML = 'インストール完了';
    } else {
      if (btn.classList.contains('btn-primary')) {
        btn.classList.replace('btn-primary', 'btn-danger');
        setTimeout(() => {
          btn.classList.replace('btn-danger', 'btn-primary');
        }, 3000);
      }
      btn.innerHTML = 'エラーが発生しました。';
    }

    setTimeout(() => {
      btn.innerHTML = beforeHTML;
      btn.removeAttribute('disabled');
    }, 3000);
  },
};
