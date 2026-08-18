import log from 'electron-log/renderer';
import * as buttonTransition from '../../lib/buttonTransition';
import { openDialog, openDirDialog } from '../../lib/ipcWrapper';
import replaceText from '../../lib/replaceText';
import { trpc } from '../../lib/trpcClient';
import packageMain from './package';

// Functions to be exported

/**
 * Displays installed version.
 */
async function displayInstalledVersion() {
  // AviUtl・拡張編集行の表示は React(ProgramRow)が tRPC 経由で行う。
  // ここでは日付表示の更新と React への再描画通知のみ行う。
  // 日付は main プロセス側(services/core.ts の getCoreDates)から取得する
  const dates = await trpc.core.getDates.query();
  if (dates) {
    replaceText('core-mod-date', new Date(dates.modDate).toLocaleString());

    replaceText('core-check-date', new Date(dates.checkDate).toLocaleString());
  } else {
    replaceText('core-mod-date', '未取得');

    replaceText('core-check-date', '未確認');
  }

  window.dispatchEvent(new Event('apm-core-changed'));
}

/**
 * Checks the latest versionof programs.
 */
async function checkLatestVersion() {
  const btn = document.getElementById(
    'check-core-version',
  ) as HTMLButtonElement;
  const { enableButton } = buttonTransition.loading(btn, '更新');

  try {
    // ダウンロードと日付更新は main プロセス側(services/core.ts)へ移設済み
    await trpc.core.checkLatestVersion.mutate();
    await displayInstalledVersion();
    buttonTransition.message(btn, '更新完了', 'success');
  } catch (e) {
    log.error(e);
    buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
  }

  setTimeout(() => {
    enableButton();
  }, 3000);
}

/**
 * Shows a dialog to select installation path and set it.
 * @param {HTMLInputElement} input - A HTMLElement of input.
 */
async function selectInstallationPath(input: HTMLInputElement) {
  const originalPath = input.value;
  const selectedPath = await openDirDialog(
    'インストール先フォルダを選択',
    originalPath,
  );
  if (selectedPath.length !== 0 && selectedPath[0] !== originalPath) {
    if (await trpc.core.hasExeditInPluginsFolder.query(selectedPath[0])) {
      await openDialog(
        'エラー',
        '拡張編集が「plugins」フォルダに配置されています。apmは拡張編集を「aviutl.exe」と同じフォルダに配置する場合のみに対応しています。',
        'error',
      );
      return;
    }

    const instPath = selectedPath[0];
    await changeInstallationPath(instPath);
    input.value = instPath;
    // インストール先の確定を React(ProgramRow)へ通知する
    window.dispatchEvent(new Event('apm-core-changed'));
  }
}

/**
 * Change the installation path.
 * @param {string} instPath - An installation path.
 */
async function changeInstallationPath(instPath: string) {
  // mod 情報の更新・migration・変換辞書の適用と再取得要否の判定は
  // main プロセス側(services/core.ts の changeInstallationPath)へ移設済み。
  // renderer は戻り値に従って再取得・再描画のみ行う
  const need = await trpc.core.changeInstallationPath.mutate(instPath);

  if (need.needScriptsUpdate) {
    await packageMain.getScriptsList(true);
  }
  if (need.needCoreUpdate) {
    await checkLatestVersion();
  }
  if (need.needPackagesUpdate) {
    await packageMain.checkPackagesList(instPath);
  }

  // redraw
  await displayInstalledVersion();
  await packageMain.setPackagesList();
}

const core = {
  displayInstalledVersion,
  checkLatestVersion,
  selectInstallationPath,
  changeInstallationPath,
};
export default core;
