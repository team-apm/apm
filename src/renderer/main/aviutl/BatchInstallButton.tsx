import type { Core } from 'apm-schema';
import React, { type JSX, useEffect, useRef, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { states } from '../../../shared/packageDisplay';
import { programs } from '../../../shared/programs';
import type { PackageState } from '../../../types/packageState';
import { TRPCReact } from '../../trpc';
import { getInstallationPath } from '../installationPath';

type ButtonPhase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'message'; message: string; color: 'success' | 'danger' };

const IDLE_LABEL = 'AviUtl・拡張編集とおすすめプラグインのインストール';

/**
 * The batch-install button of the AviUtl tab.
 * 旧 core.ts の batchInstall(+ installProgram の btn なしルート)に相当する。
 * ダウンロード失敗・破損は旧実装どおり全体を中断し、それ以外の失敗は
 * 次の対象へ進む。ただし進んだぶんは件数を数えて最後に伝える。
 * @returns {JSX.Element} The rendered component.
 */
function BatchInstallButton(): JSX.Element {
  const [phase, setPhase] = useState<ButtonPhase>({ kind: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const utils = TRPCReact.useUtils();
  const installProgramMutation = TRPCReact.core.installProgram.useMutation();
  const installPackageMutation =
    TRPCReact.packages.installPackage.useMutation();

  const finish = (message: string, color: 'success' | 'danger') => {
    clearTimeout(timer.current);
    setPhase({ kind: 'message', message, color });
    timer.current = setTimeout(() => setPhase({ kind: 'idle' }), 3000);
  };

  const onClick = async () => {
    if (phase.kind === 'loading') return;
    // 前回の復帰タイマーが残っていると loading 中に idle へ戻されるため消す
    clearTimeout(timer.current);
    setPhase({ kind: 'loading' });

    const installationPath = getInstallationPath();
    if (!installationPath) {
      finish('インストール先フォルダを指定してください。', 'danger');
      return;
    }

    // 失敗しても次へ進むが、進んだことを黙っていると 1 件も入らずに
    // 「インストール完了」と出てしまう。件数だけは持ち回る
    let failedCount = 0;

    try {
      // tRPC の Serialize 型はプロパティを optional 化するため元の型に戻す
      const coreInfo = (await utils.core.getCoreInfo.fetch()) as Core | null;
      if (!coreInfo) throw new Error('The version data do not exist.');
      for (const program of programs) {
        const progInfo = coreInfo[program];
        const result = await installProgramMutation.mutateAsync({
          program,
          version: progInfo.latestVersion,
          installationPath,
        });
        // 旧 installProgram の btn なしルート: ダウンロード失敗のみ全体を
        // エラーにし、他の失敗は次へ進む
        if (result === 'redownloadFailed') {
          throw new Error('Failed downloading the archive file.');
        }
        if (result === 'success') {
          window.dispatchEvent(new Event('apm-core-changed'));
          // 一覧と日付表示の再取得(旧 setPackagesList 相当)
          window.dispatchEvent(new Event('apm-packages-changed'));
        } else {
          // installCoreProgram には「既に入っているので何もしない」経路が
          // 無く、毎回取得して上書きする。success 以外は本当に失敗
          failedCount++;
        }
      }

      const allPackages = (
        await utils.packages.resolveInstallationStatus.fetch(installationPath)
      ).packages as PackageState[];
      const packagesToInstall = allPackages.filter(
        (p) =>
          p.info.directURL &&
          [states.notInstalled, states.installedButBroken].some(
            (status) => status === p.installationStatus,
          ),
      );
      for (const packageState of packagesToInstall) {
        const result = await installPackageMutation.mutateAsync({
          installationPath,
          packageState: { id: packageState.id, info: packageState.info },
          direct: true,
        });
        // 旧 installPackage の direct ルート: 中止・ダウンロード失敗は throw
        if (result === 'corrupt') {
          throw new Error('The archive does not match the integrity.');
        }
        if (result === 'redownloadFailed') {
          throw new Error('Failed downloading the archive file.');
        }
        if (result === 'success') {
          // 一覧と日付表示の再取得(旧 setPackagesList 相当)
          window.dispatchEvent(new Event('apm-packages-changed'));
        } else {
          // 対象は notInstalled / installedButBroken に絞ってあるので、
          // success 以外は本当に失敗
          failedCount++;
        }
      }

      if (failedCount > 0) {
        finish(`${failedCount} 件のインストールに失敗しました。`, 'danger');
      } else {
        finish('インストール完了', 'success');
      }
    } catch {
      finish('エラーが発生しました。', 'danger');
    }
  };

  return (
    <Button
      variant={phase.kind === 'message' ? phase.color : 'primary'}
      id="batch-install"
      disabled={phase.kind === 'loading'}
      onClick={() => void onClick()}
    >
      {phase.kind === 'loading' ? (
        <>
          <Spinner
            as="span"
            animation="border"
            size="sm"
            role="status"
            aria-hidden="true"
          />
          <span className="visually-hidden">Loading...</span>
        </>
      ) : phase.kind === 'message' ? (
        phase.message
      ) : (
        IDLE_LABEL
      )}
    </Button>
  );
}

export default BatchInstallButton;
