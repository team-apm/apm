const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const Store = require('electron-store');
const path = require('path');
const store = new Store();
const buttonTransition = require('../lib/buttonTransition');

/**
 * Initializes settings
 */
function initSettings() {
  if (!store.has('dataURL.extra')) store.set('dataURL.extra', '');
  if (!store.has('dataURL.main'))
    setDataUrl(null, {
      value: 'https://cdn.jsdelivr.net/gh/hal-shu-sato/apm-data@main/v2/data/',
    });
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
 * Sets a data files URL.
 *
 * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
 * @param {HTMLInputElement} dataUrl - An input element that contains a data files URL to set.
 */
function setDataUrl(btn, dataUrl) {
  let enableButton;
  if (btn !== null) enableButton = buttonTransition.loading(btn);

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
    setExtraDataUrl(null, store.get('dataURL.extra'));
  }

  if (btn !== null) {
    buttonTransition.message(btn, '設定完了', 'success');
    setTimeout(() => {
      enableButton();
    }, 3000);
  }
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
 * Sets extra data files URLs.
 *
 * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
 * @param {string} dataUrls - Data files URLs to set.
 */
function setExtraDataUrl(btn, dataUrls) {
  let enableButton;
  if (btn !== null) enableButton = buttonTransition.loading(btn);

  const packages = [path.join(store.get('dataURL.main'), 'packages.xml')];

  for (const tmpDataUrl of dataUrls.split(/\r?\n/)) {
    const dataUrl = tmpDataUrl.trim();
    if (dataUrl === '') continue;

    if (!dataUrl.startsWith('http') && !fs.existsSync(dataUrl)) {
      ipcRenderer.invoke(
        'open-err-dialog',
        'エラー',
        `有効なURLまたは場所を入力してください。(${dataUrl})`
      );
    }
    if (!(path.basename(dataUrl) === 'packages.xml')) {
      ipcRenderer.invoke(
        'open-err-dialog',
        'エラー',
        `有効なxmlファイルのURLまたは場所を入力してください。(${dataUrl})`
      );
    }

    if (path.basename(dataUrl) === 'packages.xml') packages.push(dataUrl);
  }

  store.set('dataURL.extra', dataUrls);
  store.set('dataURL.packages', packages);

  if (btn !== null) {
    buttonTransition.message(btn, '設定完了', 'success');
    setTimeout(() => {
      enableButton();
    }, 3000);
  }
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

module.exports = {
  initSettings,
  getDataUrl,
  setDataUrl,
  getExtraDataUrl,
  getCoreDataUrl,
  getPackagesDataUrl,
  getLocalPackagesDataUrl,
  getModDataUrl,
  setExtraDataUrl,
  setZoomFactor,
  changeZoomFactor,
};
