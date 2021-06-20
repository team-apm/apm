const { ipcRenderer } = require('electron');
const fs = require('fs');
const Store = require('electron-store');
const store = new Store();
const xml2js = require('xml2js');

const replaceText = (selector, text) => {
  const element = document.getElementById(selector);
  if (element) element.innerText = text;
};

window.addEventListener('DOMContentLoaded', () => {
  for (const program of ['aviutl', 'exedit']) {
    replaceText(
      `${program}-installed-version`,
      store.get('installedVersion[program]', '未インストール')
    );
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
    for (const program of ['aviutl', 'exedit']) {
      replaceText(
        `${program}-latest-version`,
        coreVersionData.core[program].latestVersion
      );
    }
  });
});
