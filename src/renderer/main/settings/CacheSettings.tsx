import React, { type JSX } from 'react';
import { formatBytes } from '../../../shared/formatBytes';
import { TRPCReact } from '../../trpc';
import { usePhase } from '../usePhase';

/**
 * The download cache size and a button to clear it (ダウンロードキャッシュ).
 * @returns {JSX.Element} The rendered component.
 */
function CacheSettings(): JSX.Element {
  const cacheSize = TRPCReact.settings.getCacheSize.useQuery();
  const clearCache = TRPCReact.settings.clearCache.useMutation();
  const clear = usePhase();

  const onClick = async () => {
    clear.start();
    try {
      const freed = await clearCache.mutateAsync();
      // null はダイアログでキャンセルされた場合。メッセージを出さずに戻す
      if (freed === null) {
        clear.finishSilently();
        return;
      }
      await cacheSize.refetch();
      clear.finish(`${formatBytes(freed)}を削除`, 'success');
    } catch {
      clear.finish('エラー', 'danger');
    }
  };

  const color = clear.phase.kind === 'message' ? clear.phase.color : 'primary';

  return (
    <div className="row mb-3">
      <label htmlFor="clear-cache" className="col-sm-3 col-form-label">
        ダウンロードキャッシュ
      </label>
      <div className="col-sm-6 d-flex align-items-center">
        <span className="text-body-secondary">
          {cacheSize.data === undefined
            ? '計算中…'
            : `${formatBytes(cacheSize.data)} 使用中`}
        </span>
      </div>
      <div className="col-sm-3">
        <button
          type="button"
          className={`btn btn-outline-${color} w-100`}
          id="clear-cache"
          disabled={clear.phase.kind === 'loading' || !cacheSize.data}
          onClick={() => void onClick()}
        >
          {clear.phase.kind === 'loading' ? (
            <>
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
              <span className="visually-hidden">Loading...</span>
            </>
          ) : clear.phase.kind === 'message' ? (
            clear.phase.message
          ) : (
            '削除'
          )}
        </button>
      </div>
    </div>
  );
}

export default CacheSettings;
