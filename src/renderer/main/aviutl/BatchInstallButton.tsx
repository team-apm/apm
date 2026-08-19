import type { Core } from 'apm-schema';
import React, { type JSX, useEffect, useRef, useState } from 'react';
import { states } from '../../../shared/packageDisplay';
import { programs } from '../../../shared/programs';
import type { PackageItem } from '../../../types/packageItem';
import { TRPCReact } from '../../trpc';
import { getInstallationPath } from '../instPath';

type ButtonPhase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'message'; message: string; color: 'success' | 'danger' };

const IDLE_LABEL = 'AviUtl・拡張編集とおすすめプラグインのインストール';

/**
 * The batch-install button of the AviUtl tab.
 * 旧 core.ts の batchInstall(+ installProgram の btn なしルート)に相当する。
 * プログラムのインストール失敗は旧実装どおり黙って次へ進み、
 * ダウンロード失敗・破損のみ全体をエラー表示にする。
 * @returns {JSX.Element} The rendered component.
 */
function BatchInstallButton(): JSX.Element {
  const [phase, setPhase] = useState<ButtonPhase>({ kind: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const utils = TRPCReact.useContext();
  const installProgramMutation = TRPCReact.core.installProgram.useMutation();
  const installPackageMutation =
    TRPCReact.packages.installPackage.useMutation();

  const finish = (message: string, color: 'success' | 'danger') => {
    setPhase({ kind: 'message', message, color });
    timer.current = setTimeout(() => setPhase({ kind: 'idle' }), 3000);
  };

  const onClick = async () => {
    if (phase.kind === 'loading') return;
    setPhase({ kind: 'loading' });

    const instPath = getInstallationPath();
    if (!instPath) {
      finish('インストール先フォルダを指定してください。', 'danger');
      return;
    }

    try {
      // tRPC の Serialize 型はプロパティを optional 化するため元の型に戻す
      const coreInfo = (await utils.core.getCoreInfo.fetch()) as Core | null;
      for (const program of programs) {
        const progInfo = coreInfo[program];
        const result = await installProgramMutation.mutateAsync({
          program,
          version: progInfo.latestVersion,
          instPath,
        });
        // 旧 installProgram の btn なしルート: ダウンロード失敗のみ全体を
        // エラーにし、他の失敗は黙って次へ進む
        if (result === 'redownloadFailed') {
          throw new Error('Failed downloading the archive file.');
        }
        if (result === 'success') {
          window.dispatchEvent(new Event('apm-core-changed'));
          // 一覧と日付表示の再取得(旧 setPackagesList 相当)
          window.dispatchEvent(new Event('apm-packages-changed'));
        }
      }

      const allPackages = (
        await utils.packages.getPackagesExtra.fetch(instPath)
      ).packages as PackageItem[];
      const packagesToInstall = allPackages.filter(
        (p) =>
          p.info.directURL &&
          [states.notInstalled, states.installedButBroken].some(
            (status) => status === p.installationStatus,
          ),
      );
      for (const packageItem of packagesToInstall) {
        const result = await installPackageMutation.mutateAsync({
          instPath,
          packageItem: { id: packageItem.id, info: packageItem.info },
          direct: true,
        });
        // 旧 installPackage の direct ルート: 破損・ダウンロード失敗は throw
        if (result === 'corrupt') {
          throw new Error('The downloaded archive file is corrupt.');
        }
        if (result === 'redownloadFailed') {
          throw new Error('Failed downloading the archive file.');
        }
        if (result === 'success') {
          // 一覧と日付表示の再取得(旧 setPackagesList 相当)
          window.dispatchEvent(new Event('apm-packages-changed'));
        }
      }

      finish('インストール完了', 'success');
    } catch {
      finish('エラーが発生しました。', 'danger');
    }
  };

  return (
    <button
      type="button"
      className={`btn btn-${phase.kind === 'message' ? phase.color : 'primary'}`}
      id="batch-install"
      disabled={phase.kind === 'loading'}
      onClick={() => void onClick()}
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
        IDLE_LABEL
      )}
    </button>
  );
}

export default BatchInstallButton;
