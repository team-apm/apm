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
 * @param {object} coreVersionData - The object of version data.
 */
function replaceCoreVersion(coreVersionData) {
  for (const program of ['aviutl', 'exedit']) {
    replaceText(
      `${program}-latest-version`,
      coreVersionData.core[program].latestVersion
    );
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  for (const program of ['aviutl', 'exedit']) {
    replaceText(
      `${program}-installed-version`,
      store.get('installedVersion[program]', '未インストール')
    );
  }
  const coreFile = await ipcRenderer.invoke('exists-temp-file', 'core.xml');
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
  }
});

/**
 * Downloads xml and return object
 *
 * @function
 * @param {url} url - The url of the file to download.
 * @returns {Promise<object>} - An object of parsed xml.
 */
async function getXmlObject(url) {
  const filePath = await ipcRenderer.invoke('download', url, true);
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
    const coreVersionData = await getXmlObject(coreXmlUrl);
    replaceCoreVersion(coreVersionData);
  });
});
