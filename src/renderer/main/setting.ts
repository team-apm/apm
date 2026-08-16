import log from 'electron-log/renderer';
import * as os from 'node:os';
import * as buttonTransition from '../../lib/buttonTransition';
import { getConfig } from '../../lib/Config';
import { changeMainZoomFactor, openDialog } from '../../lib/ipcWrapper';
import * as modList from '../../lib/modList';
import { validateDataUrls } from '../../shared/dataUrl';
const config = getConfig();

/**
 * Initializes settings
 */
async function initSettings() {
  if (!config.dataURL.hasExtra()) config.dataURL.setExtra('');
  if (!config.dataURL.hasMain())
    await setDataUrl({ value: '' }, config.dataURL.getExtra());
}

/**
 * Sets a data files URL.
 * @param {HTMLInputElement} dataUrl - An input element that contains a data files URL to set.
 * @param {string} dataUrl.value - value
 * @param {string} extraDataUrls - Data files URLs to set.
 */
async function setDataUrl(dataUrl: { value: string }, extraDataUrls: string) {
  const btn = document.getElementById('set-data-url');
  const { enableButton } =
    btn instanceof HTMLButtonElement
      ? buttonTransition.loading(btn, '設定')
      : { enableButton: undefined };

  const { mainUrl, extraUrls, errors } = validateDataUrls(
    dataUrl.value,
    extraDataUrls,
  );
  dataUrl.value = mainUrl;
  for (const message of errors) {
    await openDialog('エラー', message, 'error');
  }

  if (errors.length === 0) {
    config.dataURL.setMain(mainUrl);
    config.dataURL.setExtra(extraUrls.join(os.EOL));
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
 * @param {HTMLSelectElement} zoomFactorSelect - A zoom factor select to change value.
 */
function setZoomFactor(zoomFactorSelect: HTMLSelectElement) {
  const zoomFactor = config.getZoomFactor();
  for (const optionElement of Array.from(zoomFactorSelect.options)) {
    if (optionElement.getAttribute('value') === zoomFactor) {
      optionElement.selected = true;
      break;
    }
  }
}

/**
 * Changes a zoom factor.
 * @param {string} zoomFactor - A zoom factor to change.
 */
async function changeZoomFactor(zoomFactor: string) {
  config.setZoomFactor(zoomFactor);
  await changeMainZoomFactor(parseInt(zoomFactor) / 100);
}

const setting = {
  initSettings,
  setDataUrl,
  setZoomFactor,
  changeZoomFactor,
};
export default setting;
