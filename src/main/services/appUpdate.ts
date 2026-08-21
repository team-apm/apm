import { app, dialog, net, shell } from 'electron';
import log from 'electron-log/main';
import { readJsonSync } from 'fs-extra';
import path from 'node:path';
import { updateElectronApp } from 'update-electron-app';
import type Config from '../Config';

/**
 * Checks whether it is the installed version of apm.
 * @returns {boolean} Whether it is the installed version of apm.
 */
export function isExeVersion() {
  if (process.platform === 'win32') {
    const appDataPath = app.getPath('appData');
    const apmPath = app.getPath('exe');
    return apmPath.includes(path.dirname(appDataPath)); // Verify that it is the installed version of apm
  } else {
    return false;
  }
}

/**
 * Sets the default auto-update behavior if it is not set yet.
 * @param {Config} config - The config instance.
 */
export function ensureAutoUpdateDefault(config: Config) {
  if (!config.hasAutoUpdate()) {
    const doAutoUpdate = isExeVersion() ? 'download' : 'notify';
    config.setAutoUpdate(doAutoUpdate);
  }
}

/**
 * Checks whether a newer version is available.
 * @param {boolean} [silent] - Whether the dialog is not shown if apm is up to date.
 */
export async function checkUpdate(silent = true) {
  const server = 'https://update.electronjs.org';

  const pkg = readJsonSync(path.join(app.getAppPath(), 'package.json'));
  const repoString = (pkg.repository && pkg.repository.url) || pkg.repository;
  const repoURL = new URL(repoString);
  const dirs = repoURL.pathname.split('/');
  dirs.shift();
  // const repo = `${dirs[0]}/${dirs[1].split('.')[0]}`;
  const repo = 'team-apm/apm';

  const feed = `${server}/${repo}/${process.platform}-${
    process.arch
  }/${app.getVersion()}`;

  if (repoURL.hostname !== 'github.com') return;
  await app.whenReady();

  const icon = path.join(__dirname, '../icon/apm1024.png');

  // 旧実装(net.request)はエラーハンドラが無く、オフライン時に uncaught
  // exception で errorHandler がアプリごと終了させていた。ネットワーク失敗と
  // タイムアウトはログ + (手動確認時のみ)ダイアログに畳み込む
  let response: Awaited<ReturnType<typeof net.fetch>>;
  try {
    response = await net.fetch(feed, { signal: AbortSignal.timeout(10000) });
  } catch (e) {
    log.error(e);
    if (!silent)
      await dialog.showMessageBox({
        title: '更新確認失敗',
        message: 'apmの更新を確認できませんでした。',
        type: 'error',
        icon: icon,
      });
    return;
  }

  if (response.status === 204) {
    log.debug('It is up to date.');
    if (!silent)
      await dialog.showMessageBox({
        title: '更新確認完了',
        message: 'apmは最新のバージョンです。',
        type: 'info',
        icon: icon,
      });
    return;
  }
  if (response.status === 404) {
    log.debug('No updates are found');
    if (!silent)
      await dialog.showMessageBox({
        title: '更新確認失敗',
        message: 'apmの更新が見つかりませんでした。',
        type: 'warning',
        icon: icon,
      });
    return;
  }

  try {
    const data = (await response.json()) as { name?: string; notes?: string };
    if ('name' in data) {
      const res = dialog.showMessageBoxSync({
        title: 'アップデート',
        message:
          `${data.name}が公開されています。\n` +
          `現在のバージョン: v${app.getVersion()}\n` +
          'apmを終了して、ダウンロードページを開きますか？',
        detail: data?.notes ? 'リリースノート:\n' + data?.notes : undefined,
        buttons: ['開く', 'キャンセル'],
        cancelId: 1,
        type: 'info',
        icon: icon,
      });
      if (res === 0) {
        const releasePage = `https://github.com/${repo}/releases/latest`;
        await shell.openExternal(releasePage);
        app.quit();
      }
    }
  } catch (e) {
    log.error(e);
    if (!silent)
      await dialog.showMessageBox({
        title: '更新確認失敗',
        message: 'apmの更新を解析できませんでした。',
        type: 'error',
        icon: icon,
      });
  }
}

/**
 * Runs the auto-update according to the configured behavior.
 * @param {Config} config - The config instance.
 * @param {boolean} isDevEnv - Whether the app runs in the development environment.
 */
export async function runAutoUpdate(config: Config, isDevEnv: boolean) {
  try {
    const doAutoUpdate = config.getAutoUpdate();
    if (!isDevEnv && typeof doAutoUpdate === 'string') {
      if (doAutoUpdate === 'download') {
        updateElectronApp({ repo: 'team-apm/apm', logger: log });
      } else if (doAutoUpdate === 'notify') {
        // 応答を待つと窓の生成(launch)が最大タイムアウト分遅れるため
        // 待たない(旧実装もレスポンスを待たずに起動を続けていた)。
        // エラーは checkUpdate 内で処理済みなので握りつぶしはない
        void checkUpdate();
      }
    }
  } catch (e) {
    log.error(e);
  }
}
