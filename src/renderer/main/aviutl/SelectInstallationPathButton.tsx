import React, { type JSX } from 'react';
import { TRPCReact } from '../../trpc';

/**
 * The button to select the installation path of the AviUtl tab.
 * 旧 core.ts の selectInstallationPath・changeInstallationPath のフローに
 * 相当する。判定・更新は main プロセス側(services/core.ts)が行い、ここは
 * ダイアログの表示と再描画通知のみを行う。
 * インストール先の値はレガシー DOM の #installation-path(readonly input)が
 * 保持し、各コンポーネントは coreBridge.getInstallationPath() で読む。
 * @returns {JSX.Element} The rendered component.
 */
function SelectInstallationPathButton(): JSX.Element {
  const utils = TRPCReact.useContext();
  const openDirDialogMutation = TRPCReact.openDirDialog.useMutation();
  const openDialogMutation = TRPCReact.openDialog.useMutation();
  const changeInstallationPathMutation =
    TRPCReact.core.changeInstallationPath.useMutation();

  const selectInstallationPath = async () => {
    const input = document.getElementById(
      'installation-path',
    ) as HTMLInputElement | null;
    const originalPath = input?.value ?? '';

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

      const instPath = selectedPath[0];
      // mod 情報の更新・migration・変換辞書の適用と、必要なデータの再取得は
      // main プロセス側(services/core.ts の changeInstallationPath)が行う
      await changeInstallationPathMutation.mutateAsync(instPath);
      // 再描画通知(旧 changeInstallationPath と同一)
      window.dispatchEvent(new Event('apm-core-changed'));
      window.dispatchEvent(new Event('apm-packages-changed'));

      if (input) input.value = instPath;
      // インストール先の確定を React(ProgramRow)へ通知する
      // (旧 selectInstallationPath と同一。input 反映後にもう一度通知する)
      window.dispatchEvent(new Event('apm-core-changed'));
    }
  };

  return (
    <button
      type="button"
      className="btn btn-primary rounded-0 rounded-end"
      id="select-installation-path"
      onClick={() => void selectInstallationPath()}
    >
      AviUtlインストールフォルダを選択
    </button>
  );
}

export default SelectInstallationPathButton;
