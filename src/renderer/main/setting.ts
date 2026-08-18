import log from 'electron-log/renderer';
import { openDialog } from '../../lib/ipcWrapper';
import { trpc } from '../../lib/trpcClient';

/**
 * Initializes settings
 * 初回起動時にデフォルトのデータ取得先を設定する(UI は React 側)。
 * @returns {Promise<boolean>} Whether this is the first launch.
 */
async function initSettings(): Promise<boolean> {
  // hasMain の判定はデフォルト書き込み前に main プロセス側で行われるため、
  // 旧 preload の config.dataURL.hasMain() による初回起動判定と等価
  const { hasMain, extra } = await trpc.settings.ensureExtraDataUrl.mutate();
  if (!hasMain) {
    const { errors } = await trpc.settings.setDataUrls.mutate({
      mainUrl: '',
      extraDataUrls: extra,
    });
    for (const message of errors) {
      await openDialog('エラー', message, 'error');
    }
    if (errors.length === 0) {
      await trpc.modList.updateInfo.mutate();
    } else {
      log.error('An error has occurred while setting data URL.');
    }
  }
  return !hasMain;
}

const setting = {
  initSettings,
};
export default setting;
