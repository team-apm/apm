import type { ActionPhase } from '../usePhase';

// 旧 package.ts の checkPackagesList(パッケージ一覧の再取得ボタンフロー)の
// React 側実装。設定タブの更新ボタン(ManualUpdateTable)・スクリプト
// インストール後(PackageActions)・データエディタ保存後(monacoEditorRenderer
// からのイベント)の 3 経路から起動され、どこから呼んでもボタン表示と
// オーバーレイが連動する。renderer.tsx は React ルートを機能ごとに分けて
// createRoot しているため、実行状態は Context ではなくモジュールレベルの
// シングルトンで共有する。

let phase: ActionPhase = { kind: 'idle' };
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
 * 旧 checkPackagesList と同じ順序(ボタン loading → オーバーレイ表示 →
 * 再取得 → 一覧更新 → 結果メッセージ → オーバーレイ非表示 → 3 秒後復帰)。
 * @param {() => Promise<unknown>} refreshList - Calls packages.refreshList.
 */
export async function runPackagesListCheck(
  refreshList: () => Promise<unknown>,
) {
  setPhase({ kind: 'loading' });

  const overlay = document.getElementById('packages-table-overlay');
  if (overlay) {
    overlay.style.zIndex = '1000';
    overlay.classList.add('show');
  }

  try {
    // 再取得と日付の記録は main プロセス側(services/packages.ts の
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

  if (overlay) {
    overlay.classList.remove('show');
    overlay.style.zIndex = '-1';
  }

  setTimeout(() => setPhase({ kind: 'idle' }), 3000);
}
