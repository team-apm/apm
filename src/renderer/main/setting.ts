import log from 'electron-log';
import Store from 'electron-store';
import fs from 'fs-extra';
import * as os from 'os';
import path from 'path';
import * as buttonTransition from '../../lib/buttonTransition';
import { changeMainZoomFactor, openDialog } from '../../lib/ipcWrapper';
import * as modList from '../../lib/modList';
const store = new Store();

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
  const { enableButton } =
    btn instanceof HTMLButtonElement
      ? buttonTransition.loading(btn, '設定')
      : undefined;

  if (!dataUrl.value) {
    dataUrl.value = 'https://cdn.jsdelivr.net/gh/team-apm/apm-data@main/v3/';
  }
  const value = dataUrl.value;

  let error = false;
  if (!value.startsWith('http') && !fs.existsSync(value)) {
    await openDialog(
      'エラー',
      '有効なURLまたは場所を入力してください。',
      'error'
    );
    error = true;
  }
  if (path.extname(value) === '.json') {
    await openDialog('エラー', 'フォルダのURLを入力してください。', 'error');
    error = true;
  }

  const tmpExtraUrls = extraDataUrls
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter((url) => url !== '');

  for (const tmpDataUrl of tmpExtraUrls) {
    if (!tmpDataUrl.startsWith('http') && !fs.existsSync(tmpDataUrl)) {
      await openDialog(
        'エラー',
        `有効なURLまたは場所を入力してください。(${tmpDataUrl})`,
        'error'
      );
      error = true;
    }
    if (path.extname(tmpDataUrl) !== '.json') {
      await openDialog(
        'エラー',
        `有効なJsonファイルのURLまたは場所を入力してください。(${tmpDataUrl})`,
        'error'
      );
      error = true;
    }
  }

  if (!error) {
    store.set('dataURL.main', value);
    store.set('dataURL.extra', tmpExtraUrls.join(os.EOL));
    await modList.updateInfo();

    if (btn instanceof HTMLButtonElement) {
      buttonTransition.message(btn, '設定完了', 'success');
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
  } else {
    log.error('An error has occurred while setting data URL.');
    if (btn instanceof HTMLButtonElement) {
      buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
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
  changeMainZoomFactor(parseInt(zoomFactor) / 100);
}

const setting = {
  initSettings,
  setDataUrl,
  setZoomFactor,
  changeZoomFactor,
};
export default setting;
