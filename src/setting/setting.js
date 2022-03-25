import { ipcRenderer } from 'electron';
import fs from 'fs-extra';
import Store from 'electron-store';
import path from 'path';
const store = new Store();
import buttonTransition from '../lib/buttonTransition';

/**
 * Initializes settings
 */
async function initSettings() {
  if (!store.has('dataURL.extra')) store.set('dataURL.extra', '');
  if (!store.has('dataURL.main'))
    await setDataUrl({ value: '' }, store.get('dataURL.extra'));
}

/**
 * Sets a data files URL.
 *
 * @param {HTMLInputElement} dataUrl - An input element that contains a data files URL to set.
 * @param {string} extraDataUrls - Data files URLs to set.
 */
async function setDataUrl(dataUrl, extraDataUrls) {
  const btn = document.getElementById('set-data-url');
  let enableButton;
  if (btn !== null) enableButton = buttonTransition.loading(btn, '設定');

  if (!dataUrl.value) {
    dataUrl.value =
      'https://cdn.jsdelivr.net/gh/hal-shu-sato/apm-data@main/v2/data/';
  }

  const value = dataUrl.value;
  if (!value.startsWith('http') && !fs.existsSync(value)) {
    ipcRenderer.invoke(
      'open-err-dialog',
      'エラー',
      '有効なURLまたは場所を入力してください。'
    );
  } else if (path.extname(value) === '.xml') {
    ipcRenderer.invoke(
      'open-err-dialog',
      'エラー',
      'フォルダのURLを入力してください。'
    );
  } else {
    store.set('dataURL.main', value);

    const packages = [path.join(value, 'packages.xml')];

    for (const tmpDataUrl of extraDataUrls.split(/\r?\n/)) {
      const extraDataUrl = tmpDataUrl.trim();
      if (extraDataUrl === '') continue;

      if (!extraDataUrl.startsWith('http') && !fs.existsSync(extraDataUrl)) {
        await ipcRenderer.invoke(
          'open-err-dialog',
          'エラー',
          `有効なURLまたは場所を入力してください。(${extraDataUrl})`
        );
        break;
      }
      if (
        !['packages.xml', 'packages_list.xml'].includes(
          path.basename(extraDataUrl)
        )
      ) {
        await ipcRenderer.invoke(
          'open-err-dialog',
          'エラー',
          `有効なxmlファイルのURLまたは場所を入力してください。(${extraDataUrl})`
        );
        break;
      }

      packages.push(extraDataUrl);
    }

    store.set('dataURL.extra', extraDataUrls);
    store.set('dataURL.packages', packages);
  }

  if (btn !== null) {
    buttonTransition.message(btn, '設定完了', 'success');
    setTimeout(() => {
      enableButton();
    }, 3000);
  }
}

/**
 * Returns a data files URL.
 *
 * @returns {string} - A data files URL.
 */
function getDataUrl() {
  return store.get('dataURL.main');
}

/**
 * Returns extra data files URLs.
 *
 * @returns {string} - Data files URLs.
 */
function getExtraDataUrl() {
  return store.get('dataURL.extra');
}

/**
 * Returns a core data file URL.
 *
 * @returns {string} - A core data file URL.
 */
function getCoreDataUrl() {
  const dataUrl = getDataUrl();
  return path.join(dataUrl, 'core.xml');
}

/**
 * Returns package data files URLs.
 *
 * @param {string} instPath - An installation path.
 * @returns {Array.<string>} -Package data files URLs.
 */
function getPackagesDataUrl(instPath) {
  return store
    .get('dataURL.packages')
    .concat(
      instPath &&
        instPath.length > 0 &&
        fs.existsSync(getLocalPackagesDataUrl(instPath))
        ? [getLocalPackagesDataUrl(instPath)]
        : []
    );
}

/**
 * Returns local package data files URL.
 *
 * @param {string} instPath - An installation path.
 * @returns {string} - Package data files URL.
 */
function getLocalPackagesDataUrl(instPath) {
  return path.join(instPath, 'packages.xml');
}

/**
 * Returns a mod data file URL.
 *
 * @returns {string} - A mod data file URL.
 */
function getModDataUrl() {
  const dataUrl = getDataUrl();
  return path.join(dataUrl, 'mod.xml');
}

/**
 * Sets a zoom factor.
 *
 * @param {HTMLSelectElement} zoomFactorSelect - A zoom factor select to change value.
 */
function setZoomFactor(zoomFactorSelect) {
  const zoomFactor = store.get('zoomFactor');
  for (const optionElement of zoomFactorSelect.options) {
    if (optionElement.getAttribute('value') === zoomFactor) {
      optionElement.selected = true;
      break;
    }
  }
}

/**
 * Changes a zoom factor.
 *
 * @param {string} zoomFactor - A zoom factor to change.
 */
function changeZoomFactor(zoomFactor) {
  store.set('zoomFactor', zoomFactor);
  ipcRenderer.invoke('change-main-zoom-factor', parseInt(zoomFactor) / 100);
}

const setting = {
  initSettings,
  setDataUrl,
  getDataUrl,
  getExtraDataUrl,
  getCoreDataUrl,
  getPackagesDataUrl,
  getLocalPackagesDataUrl,
  getModDataUrl,
  setZoomFactor,
  changeZoomFactor,
};
export default setting;
