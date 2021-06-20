const { ipcRenderer } = require('electron');
const fs = require('fs');
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
 * @function
 */
async function setCoreVersions() {
  const coreFile = await ipcRenderer.invoke(
    'exists-temp-file',
    'Core/core.xml'
  );

  const aviutlVersionSelect = document.getElementById('aviutl-version-select');
  const exeditVersionSelect = document.getElementById('exedit-version-select');
  while (aviutlVersionSelect.childElementCount > 1) {
    aviutlVersionSelect.removeChild(aviutlVersionSelect.lastChild);
  }
  while (exeditVersionSelect.childElementCount > 1) {
    exeditVersionSelect.removeChild(exeditVersionSelect.lastChild);
  }

  if (coreFile.exists) {
    const xmlData = fs.readFileSync(coreFile.path, 'utf-8');
    const parser = new xml2js.Parser({ explicitArray: false });

    let object = {};
    parser.parseString(xmlData, (err, result) => {
      if (err) {
        throw err;
      } else {
        object = result;
      }
    });

    for (const program of ['aviutl', 'exedit']) {
      replaceText(
        `${program}-latest-version`,
        object.core[program].latestVersion
      );

      for (const release of object.core[program].releases.fileURL) {
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
async function getlatestVersion(btn) {
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

window.addEventListener('DOMContentLoaded', async () => {
  for (const program of ['aviutl', 'exedit']) {
    replaceText(
      `${program}-installed-version`,
      store.get('installedVersion[program]', '未インストール')
    );
  }

  setCoreVersions();

  const installationPath = document.getElementById('installation-path');
  installationPath.setAttribute('value', store.get('installationPath', ''));
});

window.addEventListener('load', () => {
  const aviutlVersionBtn = document.getElementById('aviutl-check-version');
  aviutlVersionBtn.addEventListener('click', async (event) => {
    getlatestVersion(aviutlVersionBtn);
  });

  const selectInstallationPathBtn = document.getElementById(
    'select-installation-path'
  );
  const installationPath = document.getElementById('installation-path');
  selectInstallationPathBtn.addEventListener('click', async (event) => {
    selectInstallationPath(installationPath);
  });
});
