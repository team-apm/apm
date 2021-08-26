const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const Store = require('electron-store');
const path = require('path');
const store = new Store();

/**
 * Changes the appearance of the button depending on the result of the given function.
 *
 * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
 * @param {Function} func - A method that returns the result of execution as a boolean value.
 */
function buttonTransition(btn, func) {
  btn.setAttribute('disabled', '');
  const beforeHTML = btn.innerHTML;

  if (func() === true) {
    if (btn.classList.contains('btn-primary')) {
      btn.classList.replace('btn-primary', 'btn-success');
      setTimeout(() => {
        btn.classList.replace('btn-success', 'btn-primary');
      }, 3000);
    }

    btn.innerHTML = '設定完了';
  }

  setTimeout(() => {
    btn.innerHTML = beforeHTML;
    btn.removeAttribute('disabled');
  }, 3000);
}

/**
 * Sets a data files URL.
 *
 * @param {string} dataUrl - A data files URL to set.
 * @returns {boolean} - Success or not.
 */
function setDataUrl_(dataUrl) {
  if (!dataUrl) {
    ipcRenderer.invoke(
      'open-err-dialog',
      'エラー',
      'データファイル取得先を入力してください。'
    );
  } else if (!dataUrl.startsWith('http') && !fs.existsSync(dataUrl)) {
    ipcRenderer.invoke(
      'open-err-dialog',
      'エラー',
      '有効なURLまたは場所を入力してください。'
    );
  } else if (path.extname(dataUrl) === '.xml') {
    ipcRenderer.invoke(
      'open-err-dialog',
      'エラー',
      'フォルダのURLを入力してください。'
    );
  } else {
    store.set('dataURL.main', dataUrl);
    setExtraDataUrl_(store.get('dataURL.extra'));
    return true;
  }
  return false;
}

/**
 * Sets extra data files URLs.
 *
 * @param {string} dataUrls - Data files URLs to set.
 * @returns {boolean} - Success or not.
 */
function setExtraDataUrl_(dataUrls) {
  const plugins = [path.join(store.get('dataURL.main'), 'plugins_list.xml')];
  const scripts = [path.join(store.get('dataURL.main'), 'scripts_list.xml')];

  for (const tmpDataUrl of dataUrls.split(/\r?\n/)) {
    const dataUrl = tmpDataUrl.trim();
    if (dataUrl === '') continue;

    if (!dataUrl.startsWith('http') && !fs.existsSync(dataUrl)) {
      ipcRenderer.invoke(
        'open-err-dialog',
        'エラー',
        `有効なURLまたは場所を入力してください。(${dataUrl})`
      );
      return false;
    }
    if (
      !(path.basename(dataUrl) === 'plugins_list.xml') &&
      !(path.basename(dataUrl) === 'scripts_list.xml')
    ) {
      ipcRenderer.invoke(
        'open-err-dialog',
        'エラー',
        `有効なxmlファイルのURLまたは場所を入力してください。(${dataUrl})`
      );
      return false;
    }

    if (path.basename(dataUrl) === 'plugins_list.xml') plugins.push(dataUrl);
    if (path.basename(dataUrl) === 'scripts_list.xml') scripts.push(dataUrl);
  }

  store.set('dataURL.extra', dataUrls);
  store.set('dataURL.plugins', plugins);
  store.set('dataURL.scripts', scripts);
  return true;
}

module.exports = {
  /**
   * Initializes settings
   */
  initSettings: function () {
    if (!store.has('dataURL.main'))
      store.set(
        'dataURL.main',
        'http://halshusato.starfree.jp/ato_lash/apm/data/'
      );
    if (!store.has('dataURL.extra')) setExtraDataUrl_('');
  },

  /**
   * Returns a data files URL.
   *
   * @returns {string} - A data files URL.
   */
  getDataUrl: function () {
    return store.get('dataURL.main');
  },

  /**
   * Sets a data files URL.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
   * @param {string} dataUrl - A data files URL to set.
   */
  setDataUrl: function (btn, dataUrl) {
    buttonTransition(btn, () => setDataUrl_(dataUrl));
  },

  /**
   * Returns extra data files URLs.
   *
   * @returns {string} - Data files URLs.
   */
  getExtraDataUrl: function () {
    return store.get('dataURL.extra');
  },

  /**
   * Returns plugin data files URLs.
   *
   * @returns {Array.<string>} -Plugin data files URLs.
   */
  getPluginsDataUrl: function () {
    return store.get('dataURL.plugins');
  },

  /**
   * Returns script data files URLs.
   *
   * @returns {Array.<string>} - Script data files URLs.
   */
  getScriptsDataUrl: function () {
    return store.get('dataURL.scripts');
  },

  /**
   * Sets extra data files URLs.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
   * @param {string} dataUrls - Data files URLs to set.
   */
  setExtraDataUrl: function (btn, dataUrls) {
    buttonTransition(btn, () => setExtraDataUrl_(dataUrls));
  },

  /**
   * Sets a zoom factor.
   *
   * @param {HTMLSelectElement} zoomFactorSelect - A zoom factor select to change value.
   */
  setZoomFactor: function (zoomFactorSelect) {
    const zoomFactor = store.get('zoomFactor');
    for (const optionElement of zoomFactorSelect.options) {
      if (optionElement.getAttribute('value') === zoomFactor) {
        optionElement.selected = true;
        break;
      }
    }
  },

  /**
   * Changes a zoom factor.
   *
   * @param {string} zoomFactor - A zoom factor to change.
   */
  changeZoomFactor: function (zoomFactor) {
    store.set('zoomFactor', zoomFactor);
    ipcRenderer.invoke('change-main-zoom-factor', parseInt(zoomFactor) / 100);
  },
};
