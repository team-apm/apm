const { ipcRenderer } = require('electron');
const Store = require('electron-store');
const store = new Store();

module.exports = {
  /**
   * Returns a data files URL.
   *
   * @returns {string} - A data files URL.
   */
  getDataUrl: function () {
    return store.get(
      'dataURL',
      'http://halshusato.starfree.jp/ato_lash/apm/data/'
    );
  },

  /**
   * Sets a data files URL
   *
   * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
   * @param {string} dataUrl - A data files URL to set.
   */
  setDataUrl: function (btn, dataUrl) {
    btn.setAttribute('disabled', '');
    const beforeHTML = btn.innerHTML;

    if (!dataUrl) {
      ipcRenderer.invoke(
        'open-err-dialog',
        'エラー',
        'データファイル取得先を入力してください。'
      );
    } else if (!dataUrl.startsWith('http')) {
      ipcRenderer.invoke(
        'open-err-dialog',
        'エラー',
        '有効なURLを入力してください。'
      );
    } else {
      store.set('dataURL', dataUrl);

      if (btn.classList.contains('btn-primary')) {
        btn.classList.replace('btn-primary', 'btn-success');
        setTimeout(() => {
          btn.classList.replace('btn-success', 'btn-primary');
        }, 3000);
      }
      btn.innerHTML = '設定完了';

      setTimeout(() => {
        btn.innerHTML = beforeHTML;
        btn.removeAttribute('disabled');
      }, 3000);
    }
  },
};
