import React, { type JSX, useEffect, useState } from 'react';
import type { PackageState } from '../../../types/packageState';
import { TRPCReact } from '../../trpc';
import { getInstallationPath } from '../instPath';

/**
 * The list of the recommended plugins (directURL packages) shown in the
 * batch-install section of the AviUtl tab.
 * AviutlTab の ul(#batch-install-packages)内に li 群として描画する
 * (pane の React 化前は portal で静的 HTML の ul へ差し込んでいた)。
 * 旧 package.ts の updateBatchInstallList と同一の表示。
 * クエリは PackagesTab と同じキー(adoptManuallyInstalled: true)でキャッシュを共有する
 * (apm.json の整合性補正は冪等のため表示結果は旧実装と変わらない)。
 * レガシー側からの再描画通知(apm-packages-changed イベント)で自動更新する。
 * @returns {JSX.Element} The rendered component.
 */
function BatchInstallList(): JSX.Element {
  const [instPath, setInstPath] = useState(() => getInstallationPath());

  const utils = TRPCReact.useUtils();
  const packagesQuery = TRPCReact.packages.getPackagesWithStatus.useQuery(
    { instPath, adoptManuallyInstalled: true },
    { refetchOnWindowFocus: false },
  );

  // レガシー側(preload の package.ts)からの再描画通知を受けて最新化する
  useEffect(() => {
    const listener = () => {
      setInstPath(getInstallationPath());
      void utils.packages.getPackagesWithStatus.invalidate();
    };
    window.addEventListener('apm-packages-changed', listener);
    return () => window.removeEventListener('apm-packages-changed', listener);
  }, [utils]);

  // tRPC の Serialize 型はプロパティを optional 化するため元の型に戻す
  const packages = (packagesQuery.data?.packages ?? []) as PackageState[];
  const batchInstallPackages = packages.filter((p) => p.info.directURL);

  return (
    <>
      {batchInstallPackages.map((p) => (
        <li
          key={p.id}
          className="list-group-item py-0 d-flex py-2 batch-install-package"
        >
          <div className="d-flex align-items-center flex-grow-1">
            <i className="bi bi-box-seam me-3"></i>
            <div className="name">{p.info.name}</div>
          </div>
          <div>
            <span className="installed-version">{p.installationStatus}</span>
          </div>
        </li>
      ))}
    </>
  );
}

export default BatchInstallList;
