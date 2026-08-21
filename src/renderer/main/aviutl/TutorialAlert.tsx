import React, { type JSX, useState, useSyncExternalStore } from 'react';
import { getFirstLaunch, subscribeFirstLaunch } from '../startup';

/**
 * The welcome alert shown on the first launch (旧 index.html の
 * #tutorial-alert。表示切り替えは preload が d-none を外していた)。
 * 閉じるは Bootstrap の data-bs-dismiss(DOM ごと除去)ではなく React の
 * 条件描画にする(PackagesTab の検索アラートと同じ方式。フェードアウトの
 * アニメーションだけが旧実装との差)。
 * @returns {JSX.Element | null} The rendered component.
 */
function TutorialAlert(): JSX.Element | null {
  const firstLaunch = useSyncExternalStore(
    subscribeFirstLaunch,
    getFirstLaunch,
  );
  const [dismissed, setDismissed] = useState(false);

  if (!firstLaunch || dismissed) return null;
  return (
    <div id="tutorial-alert" className="row my-2">
      <div
        className="my-0 alert alert-info alert-dismissible fade show"
        role="alert"
      >
        apmへようこそ！
        <a
          href="https://team-apm.github.io/apm/#apm%E3%81%AE%E3%83%81%E3%83%A5%E3%83%BC%E3%83%88%E3%83%AA%E3%82%A2%E3%83%AB"
          className="alert-link"
        >
          チュートリアル
        </a>
        から使い方を確認できます。
        <button
          type="button"
          className="btn-close"
          aria-label="Close"
          onClick={() => setDismissed(true)}
        ></button>
      </div>
    </div>
  );
}

export default TutorialAlert;
