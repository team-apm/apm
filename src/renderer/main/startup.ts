import log from 'electron-log/renderer';
import type { TRPCReact } from '../trpc';
import { setInstallationPath } from './installationPath';

// 初回起動かどうかのモジュールストア(TutorialAlert が購読する)。
// 値は起動フローが一度だけ false → true に変えうるのみ
let firstLaunch = false;
const listeners = new Set<() => void>();

/**
 * Returns whether this is the first launch (for useSyncExternalStore).
 * @returns {boolean} Whether this is the first launch.
 */
export function getFirstLaunch(): boolean {
  return firstLaunch;
}

/**
 * Subscribes to the first-launch flag changes (for useSyncExternalStore).
 * @param {() => void} listener - Called on change.
 * @returns {() => void} The unsubscribe function.
 */
export function subscribeFirstLaunch(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

type TrpcClient = ReturnType<(typeof TRPCReact)['useUtils']>['client'];

/**
 * Initializes the data URL settings (旧 preload の setting.initSettings)。
 * @param {TrpcClient} client - The tRPC client.
 * @returns {Promise<boolean>} Whether this is the first launch.
 */
async function initSettings(client: TrpcClient): Promise<boolean> {
  // hasMain の判定はデフォルト書き込み前に main プロセス側で行われるため、
  // 旧 preload の config.dataURL.hasMain() による初回起動判定と等価
  const { hasMain, extra } = await client.settings.ensureExtraDataUrl.mutate();
  if (!hasMain) {
    const { errors } = await client.settings.setDataUrls.mutate({
      mainUrl: '',
      extraDataUrls: extra,
    });
    for (const message of errors) {
      await client.openDialog.mutate({
        title: 'エラー',
        message,
        type: 'error',
      });
    }
    if (errors.length === 0) {
      await client.modList.updateInfo.mutate();
    } else {
      log.error('An error has occurred while setting data URL.');
    }
  }
  return !hasMain;
}

/**
 * Runs the startup flow of the main window (旧 preload の DOMContentLoaded
 * ハンドラから移設)。
 * 以下の順序は仕様
 * (migration → initSettings → ensureInstallationPath → changeInstallationPath)。
 * 並べ替え・並列化はしない。React のマウントとは並行に走り、確定した値は
 * installationPath ストアと firstLaunch ストア + apm-* イベントで各コンポーネントへ
 * 伝える(イベント購読は旧実装からの継続。ストアへの一本化は別スライス)。
 * @param {TrpcClient} client - The tRPC client.
 */
export async function runStartupFlow(client: TrpcClient): Promise<void> {
  try {
    // *global*
    // migration(実装は main プロセス側 services/migration.ts)
    if (!(await client.migration.global.mutate())) {
      await client.quitApp.mutate();
      return;
    }

    // init
    const isFirstLaunch = await initSettings(client);

    // *local*
    // インストール先の既定値書き込みと取得・mod 情報の更新・migration・
    // 変換辞書の適用は main プロセス側(services/core.ts)
    const installationPath = await client.core.ensureInstallationPath.mutate();
    await client.core.changeInstallationPath.mutate(installationPath);
    window.dispatchEvent(new Event('apm-core-changed'));
    window.dispatchEvent(new Event('apm-packages-changed'));

    // *UI*
    if (isFirstLaunch) {
      firstLaunch = true;
      listeners.forEach((listener) => listener());
    }
    setInstallationPath(installationPath);
    // インストール先確定後に ProgramRow・データエディタへ再描画を通知する
    // (旧 preload と同じく、確定前にも一度発火している)
    window.dispatchEvent(new Event('apm-core-changed'));
  } catch (e) {
    // 旧実装では preload の log.errorHandler が拾ってダイアログを出していた。
    // main ワールドへ移設したためここで同等の表示を行う
    log.error(e);
    await client.openDialog.mutate({
      title: 'エラー',
      message: '予期しないエラーが発生しました。',
      type: 'error',
    });
  }
}
