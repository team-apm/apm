const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const Store = require('electron-store');
const store = new Store();
const xml2js = require('xml2js');

/**
 *
 * @function
 * @param {string} selector - A string of id.
 * @param {string} text - A text to replace.
 */
function replaceText(selector, text) {
  const element = document.getElementById(selector);
  if (element) element.innerText = text;
}

/**
 *
 */
function showInstalledVersion() {
  for (const program of ['aviutl', 'exedit']) {
    replaceText(
      `${program}-installed-version`,
      store.get('installedVersion.' + program, '未インストール')
    );
  }
}

/**
 *
 * @returns {object} - An object parsed from core.xml.
 */
async function getCoreInfo() {
  const coreFile = await ipcRenderer.invoke(
    'exists-temp-file',
    'Core/core.xml'
  );
  if (coreFile.exists) {
    const xmlData = fs.readFileSync(coreFile.path, 'utf-8');
    const parser = new xml2js.Parser({ explicitArray: false });

    let coreInfo = {};
    parser.parseString(xmlData, (err, result) => {
      if (err) {
        throw err;
      } else {
        coreInfo = result;
      }
    });
    return coreInfo;
  } else {
    throw new Error('The version file does not exist.');
  }
}

/**
 * @function
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

  const coreInfo = await getCoreInfo();
  if (coreInfo) {
    for (const program of ['aviutl', 'exedit']) {
      replaceText(
        `${program}-latest-version`,
        coreInfo.core[program].latestVersion
      );

      for (const release of coreInfo.core[program].releases.fileURL) {
        const option = document.createElement('option');
        option.setAttribute('value', release.$.version);
        option.innerHTML = release.$.version;

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

const coreXmlUrl =
  'http://halshusato.starfree.jp/ato_lash/aviutl/data/core.xml';

/**
 *
 * @param {HTMLElement} btn - A HTMLElement of button element.
 */
async function getLatestVersion(btn) {
  btn.setAttribute('disabled', '');
  const beforeHTML = btn.innerHTML;
  btn.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>' +
    '<span class="visually-hidden">Loading...</span>';

  await ipcRenderer.invoke('download', coreXmlUrl, true, 'Core');
  setCoreVersions();

  btn.removeAttribute('disabled');
  btn.innerHTML = beforeHTML;
}

/**
 *
 * @param {HTMLElement} input - A HTMLElement of input.
 */
async function selectInstallationPath(input) {
  const selectedPath = await ipcRenderer.invoke(
    'open-dir-dialog',
    'インストール先フォルダを選択',
    input.innerText
  );
  store.set('installationPath', selectedPath);
  input.setAttribute('value', selectedPath);
}

/**
 *
 * @param {HTMLElement} btn - A HTMLElement of clicked button.
 * @param {string} program - A program name to install.
 * @param {string} version - A version to install.
 * @param {string} instPath - An installation path.
 */
async function installProgram(btn, program, version, instPath) {
  btn.setAttribute('disabled', '');
  const beforeHTML = btn.innerHTML;
  btn.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>' +
    '<span class="visually-hidden">Loading...</span>';

  const coreInfo = await getCoreInfo();
  const getUrl = () => {
    const progInfo = coreInfo.core[program];
    const prefix = progInfo.releases.$.prefix;
    const fileUrl = Array.from(progInfo.releases.fileURL).find(
      (element) => element.$.version === version
    );

    if (prefix) {
      return path.join(prefix, fileUrl._);
    } else {
      return fileUrl._;
    }
  };

  const url = getUrl();
  const archivePath = await ipcRenderer.invoke('download', url, true, 'Core');
  const unzippedPath = await ipcRenderer.invoke('unzip', archivePath);
  fs.copySync(unzippedPath, instPath);

  let filesCount = 0;
  let existCount = 0;
  for (const file of coreInfo.core[program].files.file) {
    if (typeof file === 'string') {
      filesCount++;
      if (fs.existsSync(path.join(instPath, file))) {
        existCount++;
      }
    }
  }

  if (filesCount === existCount) {
    store.set('installedVersion.' + program, version);
    showInstalledVersion();
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
    btn.removeAttribute('disabled');
    btn.innerHTML = beforeHTML;
  }, 3000);
}

window.addEventListener('DOMContentLoaded', async () => {
  showInstalledVersion();
  setCoreVersions();

  const installationPath = document.getElementById('installation-path');
  installationPath.setAttribute('value', store.get('installationPath', ''));
});

window.addEventListener('load', () => {
  const aviutlVersionBtn = document.getElementById('aviutl-check-version');
  aviutlVersionBtn.addEventListener('click', async (event) => {
    getLatestVersion(aviutlVersionBtn);
  });

  const selectInstallationPathBtn = document.getElementById(
    'select-installation-path'
  );
  const installationPath = document.getElementById('installation-path');
  selectInstallationPathBtn.addEventListener('click', async (event) => {
    selectInstallationPath(installationPath);
  });

  const aviutlInstallBtn = document.getElementById('aviutl-install');
  const aviutlVersionSelect = document.getElementById('aviutl-version-select');
  aviutlInstallBtn.addEventListener('click', async (event) => {
    installProgram(
      aviutlInstallBtn,
      'aviutl',
      aviutlVersionSelect.value,
      installationPath.value
    );
  });

  const exeditInstallBtn = document.getElementById('exedit-install');
  const exeditVersionSelect = document.getElementById('exedit-version-select');
  exeditInstallBtn.addEventListener('click', async (event) => {
    installProgram(
      exeditInstallBtn,
      'exedit',
      exeditVersionSelect.value,
      installationPath.value
    );
  });
});
