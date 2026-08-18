import ClipboardJS from 'clipboard/src/clipboard';
import { contextBridge } from 'electron';
import log from 'electron-log/renderer';
import { exposeElectronTRPC } from 'electron-trpc/main';
import 'source-map-support/register';
import { app, openDialog } from '../../lib/ipcWrapper';
import { trpc } from '../../lib/trpcClient';
import core from './core';
import { EditorContextBridge } from './monacoEditorPreload';
import setting from './setting';

log.errorHandler.startCatching({
  onError: async () => {
    await openDialog('エラー', '予期しないエラーが発生しました。', 'error');
  },
});
const editorContextBridge = new EditorContextBridge();

// メインワールドの React(AviUtl タブ ProgramRow ほか)とレガシーの橋渡し
contextBridge.exposeInMainWorld('coreBridge', {
  getInstallationPath: () => {
    const input = document.getElementById(
      'installation-path',
    ) as HTMLInputElement | null;
    return input?.value ?? '';
  },
});

// メインワールドの React(Settings ほか)から tRPC を使うための bridge
process.once('loaded', () => {
  exposeElectronTRPC();
});

window.addEventListener('DOMContentLoaded', async () => {
  // dark-theme
  const updateTheme = () => {
    document.querySelector('html').dataset.bsTheme = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches
      ? 'dark'
      : 'light';
  };
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', updateTheme);
  updateTheme();

  // *global*
  // migration(実装は main プロセス側 services/migration.ts へ移設済み)
  if (!(await trpc.migration.global.mutate())) {
    await app.quit();
    return;
  }

  // init
  const firstLaunch = await setting.initSettings();

  // *local*
  // インストール先の既定値書き込みと取得は main プロセス側
  // (services/core.ts の ensureInstallationPath)へ移設済み
  const instPath = await trpc.core.ensureInstallationPath.mutate();
  await core.changeInstallationPath(instPath);

  // *UI*
  // init
  if (firstLaunch) {
    const tutorialAlert = document.getElementById('tutorial-alert');
    tutorialAlert.classList.remove('d-none');
  }
  const installationPath = document.getElementById(
    'installation-path',
  ) as HTMLInputElement;
  installationPath.value = instPath;
  // インストール先確定後に React(ProgramRow)へ再描画を通知する
  window.dispatchEvent(new Event('apm-core-changed'));
  await editorContextBridge.setInstPath(installationPath);

  const appName = document.getElementsByClassName('app-name');
  for (let i = 0; i < appName.length; i++) {
    const element = appName.item(i) as HTMLSpanElement;
    element.innerText = await app.getName();
  }
});

window.addEventListener('load', () => {
  const installationPath = document.getElementById(
    'installation-path',
  ) as HTMLInputElement;

  // core
  const selectInstallationPathBtn = document.getElementById(
    'select-installation-path',
  );
  selectInstallationPathBtn.addEventListener('click', async () => {
    await core.selectInstallationPath(installationPath);
  });

  // 手動更新テーブル(check-core-version / check-packages-list /
  // check-apm-update)は React 側(settings/ManualUpdateTable.tsx)が描画する

  // nicommons ID
  new ClipboardJS('#copy-nicommons-id-textarea');
});
