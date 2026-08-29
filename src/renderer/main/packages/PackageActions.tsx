import type { Scripts } from 'apm-schema';
import log from 'electron-log/renderer';
import React, { type JSX, useEffect } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { states } from '../../../shared/packageDisplay';
import type { PackageState } from '../../../types/packageState';
import { TRPCReact } from '../../trpc';
import { type ActionPhase, usePhase } from '../usePhase';
import { runPackagesListCheck } from './packagesListCheck';

type WebpageItem = Scripts['webpage'][number];

export type SelectedEntry =
  | { kind: 'package'; p: PackageState }
  | { kind: 'scriptSite'; w: WebpageItem }
  | null;

/**
 * Renders one action button.
 * @param {object} props - Props.
 * @param {string} props.id - The button element id. E2E のセレクタなので変更・削除しない(e2e/install.spec.ts ほか)。
 * @param {string} props.label - The label shown when idle.
 * @param {ActionPhase} props.phase - The current phase.
 * @param {() => void} props.onClick - The click handler.
 * @returns {JSX.Element} The rendered component.
 */
function ActionButton({
  id,
  label,
  phase,
  onClick,
}: {
  id: string;
  label: string;
  phase: ActionPhase;
  onClick: () => void;
}) {
  const color = phase.kind === 'message' ? phase.color : 'primary';
  return (
    <Button
      variant={color}
      className="ms-2"
      id={id}
      disabled={phase.kind === 'loading'}
      onClick={onClick}
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
        label
      )}
    </Button>
  );
}

export type PackageActionsProps = {
  installationPath: string;
  selectedEntry: SelectedEntry;
  packages: PackageState[];
};

/**
 * The action buttons (install / uninstall / open folder / share) of the
 * packages tab, rendered in the header line of PackagesTab.
 * 旧 package.ts の installPackage・installScript・uninstallPackage・
 * openPackageFolder・sharePackages のボタンフローに相当する。
 * ファイル操作・ダウンロードは main プロセス側へ移設済みのため、ここは
 * 入力チェック・tRPC 呼び出し・結果メッセージの表示のみを行う。
 * 「要導入」リンク(PackagesTab)からのインストールは
 * apm-install-package-by-id イベントで受け取る。
 * @param {PackageActionsProps} props - Props.
 * @returns {JSX.Element} The rendered component.
 */
function PackageActions({
  installationPath,
  selectedEntry,
  packages,
}: PackageActionsProps): JSX.Element {
  const install = usePhase();
  const uninstall = usePhase();
  const folder = usePhase();
  const share = usePhase();

  const utils = TRPCReact.useUtils();
  const installPackageMutation =
    TRPCReact.packages.installPackage.useMutation();
  const installScriptMutation = TRPCReact.packages.installScript.useMutation();
  const uninstallPackageMutation =
    TRPCReact.packages.uninstallPackage.useMutation();
  const openFolderMutation = TRPCReact.packages.openPackageFolder.useMutation();
  const writeClipboardMutation = TRPCReact.writeClipboardText.useMutation();
  const refreshListMutation = TRPCReact.packages.refreshList.useMutation();

  // 一覧(PackagesTab / BatchInstallList)と日付表示(ManualUpdateTable)の
  // 再取得。旧 setPackagesList 相当
  const refreshLists = () => {
    window.dispatchEvent(new Event('apm-packages-changed'));
  };

  // 一覧データの再取得(旧 checkPackagesList 相当)。設定タブの更新ボタンと
  // 実行状態を共有する
  const checkPackagesList = async () => {
    await runPackagesListCheck(() =>
      refreshListMutation.mutateAsync(installationPath),
    );
  };

  const installScript = async (url: string) => {
    install.start();

    if (!installationPath) {
      install.finish('インストール先フォルダを指定してください。', 'danger');
      return;
    }

    let result: Awaited<
      ReturnType<typeof installScriptMutation.mutateAsync>
    > | null;
    try {
      result = await installScriptMutation.mutateAsync({
        installationPath,
        url,
      });
    } catch (e) {
      log.error(`Failed to install the script: ${url}`, e);
      result = null; // installFailed 相当
    }

    if (!result) {
      install.finish('エラーが発生しました。', 'danger');
    } else if (result.route === 'flow') {
      if (result.status === 'canceled') {
        install.finish('インストールがキャンセルされました。', 'info');
      } else if (result.status === 'downloadFailed') {
        install.finish('ダウンロード中にエラーが発生しました。', 'danger');
      } else if (result.status === 'notSupported') {
        install.finish('未対応のスクリプトです。', 'danger');
      } else {
        install.finish('指定されたパッケージは存在しません。', 'danger');
      }
    } else if (result.route === 'redirect') {
      if (result.status === 'success') {
        refreshLists();
        install.finish('インストール完了', 'success');
      } else {
        install.finish('エラーが発生しました。', 'danger');
      }
    } else if (result.status === 'noScript') {
      install.finish('スクリプトが含まれていません。', 'danger');
    } else if (result.status === 'containsPlugin') {
      install.finish(
        'プラグインが含まれているためインストールできません。',
        'danger',
      );
    } else if (result.status === 'success') {
      await checkPackagesList();
      install.finish('インストール完了', 'success');
    } else {
      install.finish('エラーが発生しました。', 'danger');
    }
  };

  const installPackage = async (packageToInstall?: PackageState) => {
    if (install.phase.kind === 'loading') return;

    // 選択エントリがスクリプト配布サイトならスクリプトのインストールへ
    if (!packageToInstall && selectedEntry?.kind === 'scriptSite') {
      await installScript(selectedEntry.w.url);
      return;
    }

    install.start();

    if (!installationPath) {
      install.finish('インストール先フォルダを指定してください。', 'danger');
      return;
    }

    let installedPackage: PackageState;
    if (packageToInstall) {
      installedPackage = { ...packageToInstall };
    } else {
      if (selectedEntry?.kind !== 'package') {
        install.finish(
          'プラグインまたはスクリプトを選択してください。',
          'danger',
        );
        return;
      }
      if (selectedEntry.p.id?.startsWith('script_')) {
        install.finish(
          'このスクリプトは上書きインストールできません。',
          'danger',
        );
        return;
      }
      installedPackage = { ...selectedEntry.p };
    }

    let result: Awaited<ReturnType<typeof installPackageMutation.mutateAsync>>;
    try {
      result = await installPackageMutation.mutateAsync({
        installationPath,
        packageState: { id: installedPackage.id, info: installedPackage.info },
        direct: false,
      });
    } catch (e) {
      log.error(`Failed to install ${installedPackage.id}.`, e);
      result = 'installFailed';
    }

    if (result === 'canceled') {
      install.finish('インストールがキャンセルされました。', 'info');
    } else if (result === 'downloadFailed') {
      install.finish('ダウンロード中にエラーが発生しました。', 'danger');
    } else if (result === 'corrupt') {
      install.finish('ファイルが一致しないため中止しました。', 'danger');
    } else if (result === 'redownloadFailed') {
      install.finish('ファイルのダウンロードに失敗しました。', 'danger');
    } else if (result === 'success') {
      refreshLists();
      install.finish('インストール完了', 'success');
    } else {
      install.finish('エラーが発生しました。', 'danger');
    }
  };

  // 「要導入」リンク(PackagesTab の detached 表示)からのインストール
  useEffect(() => {
    const listener = (e: Event) => {
      const packageId = (e as CustomEvent<string>).detail;
      const packageToInstall = packages.find((p) => p.id === packageId);
      if (!packageToInstall) return;
      void installPackage(packageToInstall);
    };
    window.addEventListener('apm-install-package-by-id', listener);
    return () =>
      window.removeEventListener('apm-install-package-by-id', listener);
  });

  const uninstallPackage = async () => {
    if (uninstall.phase.kind === 'loading') return;
    uninstall.start();

    if (selectedEntry?.kind !== 'package') {
      uninstall.finish(
        'プラグインまたはスクリプトを選択してください。',
        'danger',
      );
      return;
    }

    if (!installationPath) {
      uninstall.finish('インストール先フォルダを指定してください。', 'danger');
      return;
    }

    const uninstalledPackage = { ...selectedEntry.p };

    // 未インストールのまま押せてしまい、しかも main 側は成功を返す。
    // 実測すると「アンインストール完了」と出る — 何も消していないのに
    // 完了と報告している(#2456 と同じ種類)。
    // 無効化ではなく説明を出すのは、このボタン群が「押したら理由を言う」
    // 方式で揃っているため(選択なし・インストール先未設定も同じ形)。
    // notInstalled だけを弾く。手動インストール済みは記録に無いだけで
    // ファイルは在るので、消す操作に意味がある
    if (uninstalledPackage.installationStatus === states.notInstalled) {
      uninstall.finish('インストールされていません。', 'danger');
      return;
    }

    let result: Awaited<
      ReturnType<typeof uninstallPackageMutation.mutateAsync>
    >;
    try {
      result = await uninstallPackageMutation.mutateAsync({
        installationPath,
        packageState: {
          id: uninstalledPackage.id,
          info: uninstalledPackage.info,
        },
      });
    } catch (e) {
      log.error(`Failed to uninstall ${uninstalledPackage.id}.`, e);
      result = 'removeFailed';
    }

    if (result === 'success') {
      // スクリプト由来のパッケージは一覧データの再取得まで行う(旧挙動)
      if (!uninstalledPackage.id.startsWith('script_')) {
        refreshLists();
      } else {
        await checkPackagesList();
      }
      uninstall.finish('アンインストール完了', 'success');
    } else {
      uninstall.finish('エラーが発生しました。', 'danger');
    }
  };

  const openPackageFolder = async () => {
    if (folder.phase.kind === 'loading') return;
    folder.start();

    if (selectedEntry?.kind !== 'package') {
      folder.finish('プラグインまたはスクリプトを選択してください。', 'danger');
      return;
    }

    // catch しないと phase が loading のまま残り、ActionButton の
    // disabled が外れずボタンが二度と押せなくなる(usePhase の復帰
    // タイマーは finish 系でしか張られない)
    let exists: boolean;
    try {
      exists = await openFolderMutation.mutateAsync(selectedEntry.p.id);
    } catch (e) {
      log.error(`Failed to open the folder of ${selectedEntry.p.id}.`, e);
      folder.finish('エラーが発生しました。', 'danger');
      return;
    }
    if (!exists) {
      folder.finish('このパッケージはダウンロードされていません。', 'danger');
      return;
    }

    folder.finishSilently();
  };

  const sharePackages = async () => {
    if (share.phase.kind === 'loading') return;
    share.start();

    // getShareString は main 側で一覧の取得・状態判定まで辿るので、
    // list.json 未取得や apm.json の読み込み失敗で普通に throw する
    try {
      const text = await utils.packages.getShareString.fetch(installationPath);
      await writeClipboardMutation.mutateAsync({ text });
    } catch (e) {
      log.error('Failed to get the share string.', e);
      share.finish('エラーが発生しました。', 'danger');
      return;
    }
    share.finish('コピーしました', 'info');
  };

  // 旧 setSelectedEntry の install-package ラベル切り替えと同一
  const installLabel =
    selectedEntry?.kind === 'package' &&
    selectedEntry.p.installationStatus?.startsWith(states.installed)
      ? '　　更新　　'
      : 'インストール';

  return (
    <>
      <ActionButton
        id="install-package"
        label={installLabel}
        phase={install.phase}
        onClick={() => void installPackage()}
      />
      <ActionButton
        id="uninstall-package"
        label="アンインストール"
        phase={uninstall.phase}
        onClick={() => void uninstallPackage()}
      />
      <ActionButton
        id="open-package-folder"
        label="ダウンロードフォルダ"
        phase={folder.phase}
        onClick={() => void openPackageFolder()}
      />
      <ActionButton
        id="share-packages"
        label="共有"
        phase={share.phase}
        onClick={() => void sharePackages()}
      />
    </>
  );
}

export default PackageActions;
