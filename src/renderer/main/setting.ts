import { ipcRenderer } from 'electron';
import fs from 'fs-extra';
import Store from 'electron-store';
import path from 'path';
const store = new Store();
import buttonTransition from '../../lib/buttonTransition';

/**
 * Initializes settings
 */
async function initSettings() {
  if (!store.has('dataURL.extra')) store.set('dataURL.extra', '');
  if (!store.has('dataURL.main'))
    await setDataUrl({ value: '' }, store.get('dataURL.extra') as string);
}

/**
 * Sets a data files URL.
 *
 * @param {HTMLInputElement} dataUrl - An input element that contains a data files URL to set.
 * @param {string} dataUrl.value - value
 * @param {string} extraDataUrls - Data files URLs to set.
 */
async function setDataUrl(dataUrl: { value: string }, extraDataUrls: string) {
  const btn = document.getElementById('set-data-url');
  const enableButton =
    btn instanceof HTMLButtonElement
      ? buttonTransition.loading(btn, '設定')
      : undefined;

  if (!dataUrl.value) {
    dataUrl.value = 'https://cdn.jsdelivr.net/gh/team-apm/apm-data@main/v3/';
  }

  const value = dataUrl.value;
  if (!value.startsWith('http') && !fs.existsSync(value)) {
    ipcRenderer.invoke(
      'open-err-dialog',
      'エラー',
      '有効なURLまたは場所を入力してください。'
    );
  } else if (path.extname(value) === '.json') {
    ipcRenderer.invoke(
      'open-err-dialog',
      'エラー',
      'フォルダのURLを入力してください。'
    );
  } else {
    store.set('dataURL.main', value);

    const packages = [path.join(value, 'packages.json')];

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
      if (!['packages.json'].includes(path.basename(extraDataUrl))) {
        await ipcRenderer.invoke(
          'open-err-dialog',
          'エラー',
          `有効なJsonファイルのURLまたは場所を入力してください。(${extraDataUrl})`
        );
        break;
      }

      packages.push(extraDataUrl);
    }

    store.set('dataURL.extra', extraDataUrls);
    store.set('dataURL.packages', packages);
  }

  if (btn instanceof HTMLButtonElement) {
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
function setZoomFactor(zoomFactorSelect: HTMLSelectElement) {
  const zoomFactor = store.get('zoomFactor');
  for (const optionElement of Array.from(zoomFactorSelect.options)) {
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
function changeZoomFactor(zoomFactor: string) {
  store.set('zoomFactor', zoomFactor);
  ipcRenderer.invoke('change-main-zoom-factor', parseInt(zoomFactor) / 100);
}

const setting = {
  initSettings,
  setDataUrl,
  setZoomFactor,
  changeZoomFactor,
};
export default setting;
