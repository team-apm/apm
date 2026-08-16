import type { Core } from 'apm-schema';
import React, { type JSX, useEffect, useState } from 'react';
import { releaseLabel } from '../../../shared/coreVersionText';
import { TRPCReact } from '../../trpc';

type ButtonPhase = 'idle' | 'loading' | 'success' | 'danger';

export type ProgramRowProps = {
  program: 'aviutl' | 'exedit';
  label: string;
  iconClass: string;
  buttonRoundedClass: string;
};

/**
 * A row of the AviUtl tab showing the installed version and the version
 * dropdown of AviUtl / 拡張編集.
 * 旧 core.ts の displayInstalledVersion(表示部分)+ setCoreVersions +
 * installProgram(ボタン表示部分)に相当する。計算は tRPC 経由で main プロセス。
 * レガシー側の再描画通知(apm-core-changed イベント)で自動更新する。
 * @param {ProgramRowProps} props - Props.
 * @returns {JSX.Element} The rendered component.
 */
function ProgramRow({
  program,
  label,
  iconClass,
  buttonRoundedClass,
}: ProgramRowProps) {
  const [instPath, setInstPath] = useState(
    () => window.coreBridge?.getInstallationPath() ?? '',
  );
  const [phase, setPhase] = useState<ButtonPhase>('idle');
  const [buttonMessage, setButtonMessage] = useState('');

  const utils = TRPCReact.useContext();
  const coreInfoQuery = TRPCReact.core.getCoreInfo.useQuery();
  const installedTextsQuery =
    TRPCReact.core.getInstalledVersionTexts.useQuery(instPath);
  const installProgram = TRPCReact.core.installProgram.useMutation();

  // レガシー側(preload の core.ts)からの再描画通知を受けて最新化する
  useEffect(() => {
    const listener = () => {
      setInstPath(window.coreBridge?.getInstallationPath() ?? '');
      void utils.core.getCoreInfo.invalidate();
      void utils.core.getInstalledVersionTexts.invalidate();
    };
    window.addEventListener('apm-core-changed', listener);
    return () => window.removeEventListener('apm-core-changed', listener);
  }, [utils]);

  // tRPC の Serialize 型はプロパティを optional 化するため元の型に戻す
  const coreInfo = (coreInfoQuery.data ?? null) as Core | null;
  const releases = coreInfo?.[program]?.releases ?? [];
  const latestVersion = coreInfo?.[program]?.latestVersion ?? '';
  const installedText = installedTextsQuery.data?.[program] ?? '';

  const showError = (message: string) => {
    setPhase('danger');
    setButtonMessage(message);
    setTimeout(() => setPhase('idle'), 3000);
  };

  const onInstall = async (version: string) => {
    if (phase === 'loading') return;
    setPhase('loading');

    if (!instPath) {
      showError('インストール先フォルダを指定してください。');
      return;
    }

    let result: Awaited<ReturnType<typeof installProgram.mutateAsync>>;
    try {
      result = await installProgram.mutateAsync({
        program,
        version,
        instPath,
      });
    } catch {
      showError('エラーが発生しました。');
      return;
    }

    if (result === 'noVersionData') {
      showError('バージョンデータが存在しません。');
      return;
    }
    if (result === 'downloadFailed') {
      showError('ダウンロード中にエラーが発生しました。');
      return;
    }
    if (result === 'corrupt') {
      showError('ダウンロードされたファイルは破損しています。');
      return;
    }
    if (result === 'redownloadFailed') {
      showError('ファイルのダウンロードに失敗しました。');
      return;
    }
    if (result !== 'success') {
      // installFailed: エラー内容は main プロセス側でログ済み
      showError('エラーが発生しました。');
      return;
    }

    await utils.core.getInstalledVersionTexts.invalidate();
    // レガシーのパッケージ一覧・ニコニ・コモンズ ID 一覧を再描画する
    await window.coreBridge?.onProgramInstalled();
    setPhase('success');
    setButtonMessage('インストール完了');
    setTimeout(() => setPhase('idle'), 3000);
  };

  const buttonClass = `btn dropdown-toggle ${buttonRoundedClass} ${
    phase === 'success'
      ? 'btn-success'
      : phase === 'danger'
        ? 'btn-danger'
        : 'btn-primary'
  }`;

  return (
    <>
      <div className="d-flex align-items-center flex-grow-1">
        <i className={`bi ${iconClass} me-3`}></i> {label}
      </div>
      <div>
        <span id={`${program}-installed-version`}>{installedText}</span>
        <button
          type="button"
          className={buttonClass}
          id={`install-${program}`}
          data-bs-toggle="dropdown"
          aria-expanded="false"
          disabled={phase === 'loading'}
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
          ) : phase === 'idle' ? (
            ''
          ) : (
            buttonMessage
          )}
        </button>
        <div className="dropdown bg-body">
          <ul
            className="dropdown-menu dropdown-menu-end"
            id={`${program}-version-select`}
            aria-labelledby={`install-${program}`}
          >
            {releases.map((release) => (
              <li key={release.version}>
                <a
                  className="dropdown-item"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    void onInstall(release.version);
                  }}
                >
                  {releaseLabel(release.version, latestVersion)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

export default ProgramRow;
