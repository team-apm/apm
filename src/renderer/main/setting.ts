import log from 'electron-log/renderer';
import * as buttonTransition from '../../lib/buttonTransition';
import { openDialog } from '../../lib/ipcWrapper';
import * as modList from '../../lib/modList';
import { trpc } from '../../lib/trpcClient';

/**
 * Initializes settings
 */
async function initSettings() {
  const { hasMain, extra } = await trpc.settings.ensureExtraDataUrl.mutate();
  if (!hasMain) await setDataUrl({ value: '' }, extra);
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

  const { mainUrl, errors } = await trpc.settings.setDataUrls.mutate({
    mainUrl: dataUrl.value,
    extraDataUrls,
  });
  dataUrl.value = mainUrl;
  for (const message of errors) {
    await openDialog('エラー', message, 'error');
  }

  if (errors.length === 0) {
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
async function setZoomFactor(zoomFactorSelect: HTMLSelectElement) {
  const zoomFactor = await trpc.settings.getZoomFactor.query();
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
  await trpc.settings.changeZoomFactor.mutate(zoomFactor);
}

const setting = {
  initSettings,
  setDataUrl,
  setZoomFactor,
  changeZoomFactor,
};
export default setting;
