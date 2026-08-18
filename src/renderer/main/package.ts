import { Scripts } from 'apm-schema';
import log from 'electron-log/renderer';
import * as buttonTransition from '../../lib/buttonTransition';
import replaceText from '../../lib/replaceText';
import { trpc } from '../../lib/trpcClient';

// Functions to be exported

/**
 * Requests the React lists (PackagesTab / BatchInstallList) to refresh, and
 * updates the legacy parts that are not migrated yet (mod dates).
 * 一覧の描画・ソート・検索・フィルタは React 側(packages/PackagesTab.tsx)、
 * おすすめプラグイン一覧は React 側(aviutl/BatchInstallList.tsx)へ移設済み。
 */
async function setPackagesList() {
  // 隔離ワールドの DOM イベントはメインワールドに届くため、これで React 側が
  // tRPC クエリを再取得する
  window.dispatchEvent(new Event('apm-packages-changed'));
  await updateModDates();
}

/**
 * Updates the mod dates in the settings page.
 */
async function updateModDates() {
  // 日付は main プロセス側(services/packages.ts の getPackagesDates)から取得する
  const dates = await trpc.packages.getDates.query();
  if (dates) {
    replaceText('packages-mod-date', new Date(dates.modDate).toLocaleString());

    replaceText(
      'packages-check-date',
      new Date(dates.checkDate).toLocaleString(),
    );
  } else {
    replaceText('packages-mod-date', '未取得');

    replaceText('packages-check-date', '未確認');
  }
}

/**
 * Checks the packages list.
 * @param {string} instPath - An installation path.
 */
async function checkPackagesList(instPath: string) {
  const btn = document.getElementById(
    'check-packages-list',
  ) as HTMLButtonElement;
  const enableButton = btn
    ? buttonTransition.loading(btn, '更新').enableButton
    : undefined;

  const overlay = document.getElementById('packages-table-overlay');
  if (overlay) {
    overlay.style.zIndex = '1000';
    overlay.classList.add('show');
  }

  try {
    // 再取得と日付の記録は main プロセス側(services/packages.ts の
    // refreshPackagesList)へ移設済み
    await trpc.packages.refreshList.mutate(instPath);
    await setPackagesList();

    if (btn) buttonTransition.message(btn, '更新完了', 'success');
  } catch (e) {
    log.error(e);
    if (btn) buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
  }

  if (overlay) {
    overlay.classList.remove('show');
    overlay.style.zIndex = '-1';
  }

  if (btn) {
    setTimeout(() => {
      enableButton();
    }, 3000);
  }
}

/**
 * Checks the scripts list.
 * 取得・キャッシュ・更新日時の記録は main プロセス側(services/packages.ts)へ移設済み。
 * @param {boolean} update - Download the json file.
 * @returns {Promise<Scripts>} - An object parsed from scripts.json.
 */
async function getScriptsList(update = false) {
  return (await trpc.packages.getScriptsList.query({ update })) as {
    webpage: Scripts['webpage'];
    scripts: Scripts['scripts'];
  };
}

const packageMain = {
  setPackagesList,
  checkPackagesList,
  getScriptsList,
};
export default packageMain;
