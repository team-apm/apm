import React, { type JSX, useEffect, useRef, useState } from 'react';
import { TRPCReact } from '../../trpc';

type ButtonPhase = 'idle' | 'loading' | 'success' | 'danger';

/**
 * The data files URL settings form (データ取得先・追加データ取得先).
 * 旧 setting.ts の setDataUrl と同じ流れ: 検証+保存(tRPC)→ エラーは
 * ダイアログ表示、成功時は modList.updateInfo とボタンの完了表示。
 * @returns {JSX.Element} The rendered component.
 */
function DataUrlSettings() {
  const { data } = TRPCReact.settings.getDataUrls.useQuery();
  const [mainUrl, setMainUrl] = useState<string | null>(null);
  const [extraUrls, setExtraUrls] = useState<string | null>(null);
  const [phase, setPhase] = useState<ButtonPhase>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const setDataUrls = TRPCReact.settings.setDataUrls.useMutation();
  const updateInfo = TRPCReact.modList.updateInfo.useMutation();
  const openDialog = TRPCReact.openDialog.useMutation();
  const utils = TRPCReact.useUtils();

  const mainValue = mainUrl ?? data?.main ?? '';
  const extraValue = extraUrls ?? data?.extra ?? '';

  const onSet = async () => {
    // 前回の復帰タイマーが残っていると loading 中に idle へ戻されるため消す
    clearTimeout(timer.current);
    setPhase('loading');
    try {
      const result = await setDataUrls.mutateAsync({
        mainUrl: mainValue,
        extraDataUrls: extraValue,
      });
      // 未承認オリジンの確認ダイアログでキャンセルされたときは保存されて
      // いないので、成功でも失敗でもなく入力へ戻る
      if (result.canceled) {
        setPhase('idle');
        return;
      }
      setMainUrl(result.mainUrl);
      for (const message of result.errors) {
        await openDialog.mutateAsync({
          title: 'エラー',
          message,
          type: 'error',
        });
      }
      if (result.errors.length === 0) {
        await updateInfo.mutateAsync();
        await utils.settings.getDataUrls.invalidate();
        setPhase('success');
      } else {
        setPhase('danger');
      }
    } catch {
      setPhase('danger');
    }
    timer.current = setTimeout(() => setPhase('idle'), 3000);
  };

  const buttonClass =
    phase === 'success'
      ? 'btn btn-success w-100'
      : phase === 'danger'
        ? 'btn btn-danger w-100'
        : 'btn btn-primary w-100';

  return (
    <>
      <div className="row mb-3">
        <label htmlFor="data-url" className="col-sm-3 col-form-label">
          データ取得先
        </label>
        <div className="col-sm-6">
          <input
            className="form-control"
            id="data-url"
            type="text"
            placeholder="空白でデフォルト"
            aria-label="Data URL"
            value={mainValue}
            onChange={(e) => setMainUrl(e.target.value)}
          />
        </div>
        <div className="col-sm-3">
          <button
            type="button"
            className={buttonClass}
            id="set-data-url"
            disabled={phase === 'loading'}
            onClick={onSet}
          >
            {phase === 'loading' ? (
              <>
                <span
                  className="spinner-border spinner-border-sm"
                  role="status"
                  aria-hidden="true"
                ></span>
                <span className="visually-hidden">Loading...</span>
              </>
            ) : phase === 'success' ? (
              '設定完了'
            ) : phase === 'danger' ? (
              'エラーが発生しました。'
            ) : (
              '設定'
            )}
          </button>
        </div>
      </div>
      <div className="row mb-3">
        <label htmlFor="extra-data-url" className="col-sm-3 col-form-label">
          追加データ取得先
        </label>
        <div className="col-sm-6">
          <textarea
            className="form-control"
            id="extra-data-url"
            placeholder="例: https://example.com/packages.json"
            aria-label="Extra Data URL"
            value={extraValue}
            onChange={(e) => setExtraUrls(e.target.value)}
          ></textarea>
        </div>
        <div className="col-sm-3"></div>
      </div>
    </>
  );
}

export default DataUrlSettings;
