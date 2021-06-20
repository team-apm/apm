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
 * @param {object} coreVersionData - The object of version data. If it is not provided, replace with 'Not acquired'
 */
function replaceCoreVersion(coreVersionData) {
  if (coreVersionData) {
    for (const program of ['aviutl', 'exedit']) {
      replaceText(
        `${program}-latest-version`,
        coreVersionData.core[program].latestVersion
      );
    }
  } else {
    for (const program of ['aviutl', 'exedit']) {
      replaceText(`${program}-latest-version`, '未取得');
    }
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  for (const program of ['aviutl', 'exedit']) {
    replaceText(
      `${program}-installed-version`,
      store.get('installedVersion[program]', '未インストール')
    );
  }

  const coreFile = await ipcRenderer.invoke(
    'exists-temp-file',
    'Core/core.xml'
  );
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
    replaceCoreVersion(object);
  } else {
    replaceCoreVersion();
  }

  const installationPath = document.getElementById('installation-path');
  installationPath.setAttribute('value', store.get('installationPath', ''));
});

/**
 * Downloads xml and return object
 *
 * @function
 * @param {url} url - The url of the file to download.
 * @returns {Promise<object>} - An object of parsed xml.
 */
async function getXmlObject(url) {
  const filePath = await ipcRenderer.invoke('download', url, true, 'Core');
  const xmlData = fs.readFileSync(filePath, 'utf-8');
  const parser = new xml2js.Parser({ explicitArray: false });
  let object = {};
  parser.parseString(xmlData, (err, result) => {
    if (err) {
      throw err;
    } else {
      object = result;
    }
  });
  return object;
}

window.addEventListener('load', () => {
  const aviutlVersionBtn = document.getElementById('aviutl-check-version');
  const coreXmlUrl =
    'http://halshusato.starfree.jp/ato_lash/aviutl/data/core.xml';

  aviutlVersionBtn.addEventListener('click', async (event) => {
    aviutlVersionBtn.setAttribute('disabled', '');
    const beforeHTML = aviutlVersionBtn.innerHTML;
    aviutlVersionBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>' +
      '<span class="visually-hidden">Loading...</span>';

    const coreVersionData = await getXmlObject(coreXmlUrl);
    replaceCoreVersion(coreVersionData);

    aviutlVersionBtn.removeAttribute('disabled');
    aviutlVersionBtn.innerHTML = beforeHTML;
  });

  const selectInstallationPathBtn = document.getElementById(
    'select-installation-path'
  );
  const installationPath = document.getElementById('installation-path');
  selectInstallationPathBtn.addEventListener('click', async (event) => {
    const selectedPath = await ipcRenderer.invoke(
      'open-dir-dialog',
      'インストール先フォルダを選択',
      installationPath.innerText
    );
    store.set('installationPath', selectedPath);
    installationPath.setAttribute('value', selectedPath);
  });
});
