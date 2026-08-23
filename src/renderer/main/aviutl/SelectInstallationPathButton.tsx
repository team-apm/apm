import log from 'electron-log/renderer';
import React, { type JSX } from 'react';
import { Button } from 'react-bootstrap';
import { TRPCReact } from '../../trpc';
import { getInstallationPath, setInstallationPath } from '../installationPath';

/**
 * The button to select the installation path of the AviUtl tab.
 * 旧 core.ts の selectInstallationPath・changeInstallationPath のフローに
 * 相当する。判定・更新は main プロセス側(services/core.ts)が行い、ここは
 * ダイアログの表示と再描画通知のみを行う。
 * インストール先の値は installationPath ストアが保持する。
 * @returns {JSX.Element} The rendered component.
 */
function SelectInstallationPathButton(): JSX.Element {
  const utils = TRPCReact.useUtils();
  const openDirDialogMutation = TRPCReact.openDirDialog.useMutation();
  const openDialogMutation = TRPCReact.openDialog.useMutation();
  const changeInstallationPathMutation =
    TRPCReact.core.changeInstallationPath.useMutation();

  const selectInstallationPath = async () => {
    const originalPath = getInstallationPath();

    const selectedPath = await openDirDialogMutation.mutateAsync({
      title: 'インストール先フォルダを選択',
      defaultPath: originalPath,
    });
    if (selectedPath.length !== 0 && selectedPath[0] !== originalPath) {
      if (await utils.core.hasExeditInPluginsFolder.fetch(selectedPath[0])) {
        await openDialogMutation.mutateAsync({
          title: 'エラー',
          message:
            '拡張編集が「plugins」フォルダに配置されています。apmは拡張編集を「aviutl.exe」と同じフォルダに配置する場合のみに対応しています。',
          type: 'error',
        });
        return;
      }

      const installationPath = selectedPath[0];
      // mod 情報の更新・migration・変換辞書の適用と、必要なデータの再取得は
      // main プロセス側(services/core.ts の changeInstallationPath)が行う。
      // catch しないと、失敗しても何のメッセージも出ないまま
      // 「選んだのに変わらない」状態になる(このボタンは phase を持たず
      // ラベルが変わらないので、押した結果が画面に一切現れない)
      try {
        await changeInstallationPathMutation.mutateAsync(installationPath);
      } catch (e) {
        log.error(
          `Failed to change the installation path: ${installationPath}`,
          e,
        );
        await openDialogMutation.mutateAsync({
          title: 'エラー',
          message: 'インストール先の変更に失敗しました。',
          type: 'error',
        });
        return;
      }
      // 再描画通知(旧 changeInstallationPath と同一)
      window.dispatchEvent(new Event('apm-core-changed'));
      window.dispatchEvent(new Event('apm-packages-changed'));

      setInstallationPath(installationPath);
      // インストール先の確定を React(ProgramRow)へ通知する
      // (旧 selectInstallationPath と同一。ストア反映後にもう一度通知する)
      window.dispatchEvent(new Event('apm-core-changed'));
    }
  };

  return (
    <Button
      variant="primary"
      className="rounded-0 rounded-end"
      id="select-installation-path"
      onClick={() => void selectInstallationPath()}
    >
      AviUtlインストールフォルダを選択
    </Button>
  );
}

export default SelectInstallationPathButton;
