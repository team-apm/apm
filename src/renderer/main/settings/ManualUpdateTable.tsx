import React, { type JSX, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { TRPCReact } from '../../trpc';
import {
  getPhase,
  runPackagesListCheck,
  subscribePhase,
} from '../packages/packagesListCheck';
import { type ActionPhase, usePhase } from '../usePhase';

/**
 * Renders one 更新 button of the manual-update table.
 * @param {object} props - Props.
 * @param {string} props.id - The button element id (kept from the legacy DOM).
 * @param {ActionPhase} props.phase - The current phase.
 * @param {() => void} props.onClick - The click handler.
 * @returns {JSX.Element} The rendered component.
 */
function UpdateButton({
  id,
  phase,
  onClick,
}: {
  id: string;
  phase: ActionPhase;
  onClick: () => void;
}) {
  const color = phase.kind === 'message' ? phase.color : 'primary';
  return (
    <button
      type="button"
      className={`btn btn-${color} w-100`}
      id={id}
      disabled={phase.kind === 'loading'}
      onClick={onClick}
    >
      {phase.kind === 'loading' ? (
        <>
          <span
            className="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          ></span>
          <span className="visually-hidden">Loading...</span>
        </>
      ) : phase.kind === 'message' ? (
        phase.message
      ) : (
        '更新'
      )}
    </button>
  );
}

/**
 * Formats the mod/check dates of the manual-update table.
 * 旧 updateModDates / displayInstalledVersion の日付表示と同一。
 * @param {{ modDate: number; checkDate: number } | null | undefined} dates -
 *   The dates, or null if not fetched.
 * @returns {{ mod: string; check: string }} The texts to display.
 */
function formatDates(dates: { modDate: number; checkDate: number } | null) {
  if (!dates) return { mod: '未取得', check: '未確認' };
  return {
    mod: new Date(dates.modDate).toLocaleString(),
    check: new Date(dates.checkDate).toLocaleString(),
  };
}

/**
 * The manual-update table (core / packages / apm) of the settings tab.
 * 旧 core.ts の checkLatestVersion・displayInstalledVersion(日付部分)と
 * 旧 package.ts の updateModDates・checkPackagesList のボタンフローに相当する。
 * パッケージデータの更新フローは packagesListCheck(シングルトン)が持ち、
 * スクリプトインストール後(PackageActions)・データエディタ保存後
 * (apm-check-packages-list イベント)からも同じフローが走る。
 * @returns {JSX.Element} The rendered component.
 */
function ManualUpdateTable(): JSX.Element {
  const utils = TRPCReact.useContext();
  const coreDatesQuery = TRPCReact.core.getDates.useQuery();
  const packagesDatesQuery = TRPCReact.packages.getDates.useQuery();
  const checkLatestVersionMutation =
    TRPCReact.core.checkLatestVersion.useMutation();
  const refreshListMutation = TRPCReact.packages.refreshList.useMutation();
  const checkUpdateMutation = TRPCReact.checkUpdate.useMutation();

  const core = usePhase();
  const packagesPhase = useSyncExternalStore(subscribePhase, getPhase);

  const checkPackagesList = async () => {
    // 旧実装どおり呼び出し時点の入力値を使う
    const instPath = window.coreBridge?.getInstallationPath() ?? '';
    await runPackagesListCheck(() => refreshListMutation.mutateAsync(instPath));
  };

  // レガシー・他コンポーネントからの再描画通知と、データエディタ保存後の
  // 更新要求(隔離ワールドの DOM イベントはメインワールドに届く)
  useEffect(() => {
    const onCoreChanged = () => {
      void utils.core.getDates.invalidate();
    };
    const onPackagesChanged = () => {
      void utils.packages.getDates.invalidate();
    };
    const onCheckPackagesList = () => {
      void checkPackagesList();
    };
    window.addEventListener('apm-core-changed', onCoreChanged);
    window.addEventListener('apm-packages-changed', onPackagesChanged);
    window.addEventListener('apm-check-packages-list', onCheckPackagesList);
    return () => {
      window.removeEventListener('apm-core-changed', onCoreChanged);
      window.removeEventListener('apm-packages-changed', onPackagesChanged);
      window.removeEventListener(
        'apm-check-packages-list',
        onCheckPackagesList,
      );
    };
  });

  const checkCoreVersion = async () => {
    if (core.phase.kind === 'loading') return;
    core.start();
    try {
      // ダウンロードと日付更新は main プロセス側(services/core.ts)へ移設済み
      await checkLatestVersionMutation.mutateAsync();
      await utils.core.getDates.invalidate();
      // AviUtl タブの ProgramRow が再取得する
      window.dispatchEvent(new Event('apm-core-changed'));
      core.finish('更新完了', 'success');
    } catch (e) {
      console.error(e);
      core.finish('エラーが発生しました。', 'danger');
    }
  };

  // tRPC の Serialize 型は出力のプロパティを optional 化するため元の型に戻す
  const coreDates = formatDates(
    (coreDatesQuery.data ?? null) as {
      modDate: number;
      checkDate: number;
    } | null,
  );
  const packagesDates = formatDates(
    (packagesDatesQuery.data ?? null) as {
      modDate: number;
      checkDate: number;
    } | null,
  );

  const tbody = document.getElementById('manual-update-tbody');
  if (!tbody) return <></>;

  return createPortal(
    <>
      <tr>
        <th scope="row">AviUtl・拡張編集データ</th>
        <td>
          <span id="core-mod-date">{coreDates.mod}</span>
        </td>
        <td>
          <span id="core-check-date">{coreDates.check}</span>
        </td>
        <td>
          <div className="bg-body">
            <UpdateButton
              id="check-core-version"
              phase={core.phase}
              onClick={() => void checkCoreVersion()}
            />
          </div>
        </td>
      </tr>
      <tr>
        <th scope="row">パッケージデータ</th>
        <td>
          <span id="packages-mod-date">{packagesDates.mod}</span>
        </td>
        <td>
          <span id="packages-check-date">{packagesDates.check}</span>
        </td>
        <td>
          <div className="bg-body">
            <UpdateButton
              id="check-packages-list"
              phase={packagesPhase}
              onClick={() => void checkPackagesList()}
            />
          </div>
        </td>
      </tr>
      <tr>
        <th scope="row">apm</th>
        <td>-</td>
        <td>-</td>
        <td>
          <div className="bg-body">
            {/* 旧実装どおりボタンの状態遷移はなし(結果は main 側のダイアログ) */}
            <button
              type="button"
              className="btn btn-primary w-100"
              id="check-apm-update"
              onClick={() => checkUpdateMutation.mutate()}
            >
              更新
            </button>
          </div>
        </td>
      </tr>
    </>,
    tbody,
  );
}

export default ManualUpdateTable;
