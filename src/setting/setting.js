const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const Store = require('electron-store');
const path = require('path');
const store = new Store();
const buttonTransition = require('../lib/buttonTransition');

module.exports = {
  /**
   * Initializes settings
   */
  initSettings: function () {
    if (!store.has('dataURL.extra')) store.set('dataURL.extra', '');
    if (!store.has('dataURL.main'))
      this.setDataUrl(null, 'http://halshusato.starfree.jp/ato_lash/apm/data/');
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
    let enableButton;
    if (btn !== null) enableButton = buttonTransition.loading(btn);

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
      this.setExtraDataUrl(null, store.get('dataURL.extra'));
    }

    if (btn !== null) {
      buttonTransition.message(btn, '設定完了', 'success');
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
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
   * Sets extra data files URLs.
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
   * @param {string} dataUrls - Data files URLs to set.
   */
  setExtraDataUrl: function (btn, dataUrls) {
    let enableButton;
    if (btn !== null) enableButton = buttonTransition.loading(btn);

    const plugins = [path.join(store.get('dataURL.main'), 'plugins_list.xml')];

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
      if (!(path.basename(dataUrl) === 'plugins_list.xml')) {
        ipcRenderer.invoke(
          'open-err-dialog',
          'エラー',
          `有効なxmlファイルのURLまたは場所を入力してください。(${dataUrl})`
        );
      }

      if (path.basename(dataUrl) === 'plugins_list.xml') plugins.push(dataUrl);
    }

    store.set('dataURL.extra', dataUrls);
    store.set('dataURL.plugins', plugins);

    if (btn !== null) {
      buttonTransition.message(btn, '設定完了', 'success');
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
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
