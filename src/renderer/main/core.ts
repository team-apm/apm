import { openDialog, openDirDialog } from '../../lib/ipcWrapper';
import { trpc } from '../../lib/trpcClient';

// Functions to be exported

/**
 * Shows a dialog to select installation path and set it.
 * @param {HTMLInputElement} input - A HTMLElement of input.
 */
async function selectInstallationPath(input: HTMLInputElement) {
  const originalPath = input.value;
  const selectedPath = await openDirDialog(
    'インストール先フォルダを選択',
    originalPath,
  );
  if (selectedPath.length !== 0 && selectedPath[0] !== originalPath) {
    if (await trpc.core.hasExeditInPluginsFolder.query(selectedPath[0])) {
      await openDialog(
        'エラー',
        '拡張編集が「plugins」フォルダに配置されています。apmは拡張編集を「aviutl.exe」と同じフォルダに配置する場合のみに対応しています。',
        'error',
      );
      return;
    }

    const instPath = selectedPath[0];
    await changeInstallationPath(instPath);
    input.value = instPath;
    // インストール先の確定を React(ProgramRow)へ通知する
    window.dispatchEvent(new Event('apm-core-changed'));
  }
}

/**
 * Change the installation path.
 * @param {string} instPath - An installation path.
 */
async function changeInstallationPath(instPath: string) {
  // mod 情報の更新・migration・変換辞書の適用と、必要なデータの再取得は
  // main プロセス側(services/core.ts の changeInstallationPath)へ移設済み。
  // renderer は再描画の通知のみ行う
  await trpc.core.changeInstallationPath.mutate(instPath);

  // redraw(AviUtl タブの ProgramRow・パッケージ一覧・日付表示が再取得する)
  window.dispatchEvent(new Event('apm-core-changed'));
  window.dispatchEvent(new Event('apm-packages-changed'));
}

const core = {
  selectInstallationPath,
  changeInstallationPath,
};
export default core;
