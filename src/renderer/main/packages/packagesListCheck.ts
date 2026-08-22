import type { ActionPhase } from '../usePhase';

// 旧 package.ts の checkPackagesList(パッケージ一覧の再取得ボタンフロー)の
// React 側実装。設定タブの更新ボタン(ManualUpdateTable)・スクリプト
// インストール後(PackageActions)・データエディタ保存後(monacoEditorRenderer
// からのイベント)の 3 経路から起動され、どこから呼んでもボタン表示と
// オーバーレイが連動する。実行状態は起動元と表示側(別タブ)にまたがるため、
// Context ではなくモジュールシングルトン + useSyncExternalStore で共有する
// (installationPath / startup の firstLaunch も同じパターン)。

let phase: ActionPhase = { kind: 'idle' };
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

const setPhase = (next: ActionPhase) => {
  phase = next;
  listeners.forEach((listener) => listener());
};

/**
 * Subscribes to the phase changes (for useSyncExternalStore).
 * @param {() => void} listener - Called on every phase change.
 * @returns {() => void} The unsubscribe function.
 */
export function subscribePhase(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Returns the current phase (for useSyncExternalStore).
 * @returns {ActionPhase} The current phase.
 */
export function getPhase() {
  return phase;
}

/**
 * Runs the packages-list check flow: shows the loading states, refreshes the
 * list data in the main process, and notifies the React lists.
 * 旧 checkPackagesList と同じ順序(ボタン loading → 再取得 → 一覧更新 →
 * 結果メッセージ → 3 秒後復帰)。一覧のオーバーレイは PackagesTab が
 * この phase(loading)から導出して表示する。
 * @param {() => Promise<unknown>} refreshList - Calls packages.refreshList.
 */
export async function runPackagesListCheck(
  refreshList: () => Promise<unknown>,
) {
  // 前回の復帰タイマーが残っていると loading 中に idle へ戻されるため消す
  if (timer !== null) clearTimeout(timer);
  setPhase({ kind: 'loading' });

  try {
    // 再取得と日付の記録は main プロセス側(services/packageList.ts の
    // refreshPackagesList)へ移設済み
    await refreshList();
    // 一覧(PackagesTab / BatchInstallList)と日付表示(ManualUpdateTable)が
    // このイベントで再取得する
    window.dispatchEvent(new Event('apm-packages-changed'));

    setPhase({ kind: 'message', message: '更新完了', color: 'success' });
  } catch (e) {
    console.error(e);
    setPhase({
      kind: 'message',
      message: 'エラーが発生しました。',
      color: 'danger',
    });
  }

  timer = setTimeout(() => setPhase({ kind: 'idle' }), 3000);
}
