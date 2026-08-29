import type { Core } from 'apm-schema';
import React, {
  type JSX,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Dropdown, Spinner } from 'react-bootstrap';
import { releaseLabel } from '../../../shared/coreVersionText';
import { TRPCReact } from '../../trpc';
import {
  getInstallationPath,
  subscribeInstallationPath,
} from '../installationPath';

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
 * 他コンポーネントからの再描画通知(apm-core-changed イベント)で自動更新する。
 * @param {ProgramRowProps} props - Props.
 * @returns {JSX.Element} The rendered component.
 */
function ProgramRow({
  program,
  label,
  iconClass,
  buttonRoundedClass,
}: ProgramRowProps) {
  // インストール先はストアを購読する。DOM イベント経由で読み直すと、
  // 通知の発火とストア更新の順序に依存してしまう(起動フローも
  // SelectInstallationPathButton も setInstallationPath の前後で撃つ)
  const installationPath = useSyncExternalStore(
    subscribeInstallationPath,
    getInstallationPath,
  );
  const [phase, setPhase] = useState<ButtonPhase>('idle');
  const [buttonMessage, setButtonMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // 待機中のボタンはキャレットだけになり、読み上げ名が空になる。文字を出すと
  // 列の幅が変わって行の整列が崩れるため、見た目は変えずに名前だけを与える。
  // 状態メッセージを出している間は付けない — aria-label は要素の文字を上書きするので、
  // 「インストール完了」が読み上げから消えてしまう
  const idleName = phase === 'idle' ? `${label}をインストール` : undefined;

  const utils = TRPCReact.useUtils();
  const coreInfoQuery = TRPCReact.core.getCoreInfo.useQuery();
  const installedTextsQuery =
    TRPCReact.core.getInstalledVersionTexts.useQuery(installationPath);
  const installProgram = TRPCReact.core.installProgram.useMutation();

  // 通知元(startup / SelectInstallationPathButton / BatchInstallButton /
  // ManualUpdateTable)とは親子関係に無く、タブもまたぐため props でも
  // Context でも届かない。window イベントで受ける
  // (queryClient への一本化は未着手 — AGENTS.md 落とし穴)。
  // インストール先そのものはストアの購読で別に追う
  useEffect(() => {
    const listener = () => {
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
    clearTimeout(timer.current);
    setPhase('danger');
    setButtonMessage(message);
    timer.current = setTimeout(() => setPhase('idle'), 3000);
  };

  const onInstall = async (version: string) => {
    if (phase === 'loading') return;
    // 前回の復帰タイマーが残っていると loading 中に idle へ戻されるため消す
    clearTimeout(timer.current);
    setPhase('loading');

    if (!installationPath) {
      showError('インストール先フォルダを指定してください。');
      return;
    }

    let result: Awaited<ReturnType<typeof installProgram.mutateAsync>>;
    try {
      result = await installProgram.mutateAsync({
        program,
        version,
        installationPath,
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
      showError('ファイルが一致しないため中止しました。');
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
    // パッケージ一覧・日付表示・ニコニ・コモンズ ID 一覧を再描画する
    // (旧 setPackagesList 相当)
    window.dispatchEvent(new Event('apm-packages-changed'));
    setPhase('success');
    setButtonMessage('インストール完了');
    timer.current = setTimeout(() => setPhase('idle'), 3000);
  };

  return (
    <>
      <div className="d-flex align-items-center flex-grow-1">
        <i className={`bi ${iconClass} me-3`}></i> {label}
      </div>
      <div>
        <span id={`${program}-installed-version`}>{installedText}</span>
        <Dropdown align="end" className="d-inline-block">
          <Dropdown.Toggle
            variant={
              phase === 'success'
                ? 'success'
                : phase === 'danger'
                  ? 'danger'
                  : 'primary'
            }
            className={buttonRoundedClass}
            id={`install-${program}`}
            disabled={phase === 'loading'}
            aria-label={idleName}
            title={idleName}
          >
            {phase === 'loading' ? (
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
            ) : phase === 'idle' ? (
              ''
            ) : (
              buttonMessage
            )}
          </Dropdown.Toggle>
          <Dropdown.Menu id={`${program}-version-select`}>
            {releases.map((release) => (
              <Dropdown.Item
                key={release.version}
                onClick={() => void onInstall(release.version)}
              >
                {releaseLabel(release.version, latestVersion)}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </>
  );
}

export default ProgramRow;
