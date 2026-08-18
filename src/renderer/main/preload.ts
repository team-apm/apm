import ClipboardJS from 'clipboard/src/clipboard';
import { contextBridge } from 'electron';
import log from 'electron-log/renderer';
import { exposeElectronTRPC } from 'electron-trpc/main';
import 'source-map-support/register';
import { app, checkUpdate, openDialog } from '../../lib/ipcWrapper';
import { trpc } from '../../lib/trpcClient';
import core from './core';
import { EditorContextBridge } from './monacoEditorPreload';
import packageMain from './package';
import setting from './setting';

log.errorHandler.startCatching({
  onError: async () => {
    await openDialog('エラー', '予期しないエラーが発生しました。', 'error');
  },
});
const editorContextBridge = new EditorContextBridge();

// メインワールドの React(AviUtl タブ ProgramRow)とレガシーの橋渡し
contextBridge.exposeInMainWorld('coreBridge', {
  getInstallationPath: () => {
    const input = document.getElementById(
      'installation-path',
    ) as HTMLInputElement | null;
    return input?.value ?? '';
  },
  onProgramInstalled: async () => {
    await packageMain.setPackagesList();
  },
});

// メインワールドの React(PackageActions ほか)とレガシーの橋渡し。
// 一覧・日付表示の更新はレガシー側の関数がイベント通知まで行う
contextBridge.exposeInMainWorld('packagesBridge', {
  setPackagesList: async () => {
    await packageMain.setPackagesList();
  },
  checkPackagesList: async () => {
    const input = document.getElementById(
      'installation-path',
    ) as HTMLInputElement | null;
    await packageMain.checkPackagesList(input?.value ?? '');
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
  const checkCoreVersionBtn = document.getElementById('check-core-version');
  checkCoreVersionBtn.addEventListener('click', async () => {
    await core.checkLatestVersion();
  });

  const selectInstallationPathBtn = document.getElementById(
    'select-installation-path',
  );
  selectInstallationPathBtn.addEventListener('click', async () => {
    await core.selectInstallationPath(installationPath);
  });

  // batch-install ボタンは React 側(aviutl/BatchInstallButton.tsx)が描画する

  // packages
  const checkPackagesListBtn = document.getElementById('check-packages-list');
  checkPackagesListBtn.addEventListener('click', async () => {
    await packageMain.checkPackagesList(installationPath.value);
  });

  // アクションボタンは React 側(packages/PackageActions.tsx)が描画し、
  // フィルタボタンのクリックは React 側(packages/PackagesTab.tsx)が購読する

  // nicommons ID
  new ClipboardJS('#copy-nicommons-id-textarea');

  // settings(UI は React 化済み。手動更新まわりのみ残る)
  const checkApmUpdateBtn = document.getElementById('check-apm-update');
  checkApmUpdateBtn.addEventListener('click', async () => {
    await checkUpdate();
  });
});
