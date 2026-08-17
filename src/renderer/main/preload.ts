import ClipboardJS from 'clipboard/src/clipboard';
import { contextBridge } from 'electron';
import log from 'electron-log/renderer';
import { exposeElectronTRPC } from 'electron-trpc/main';
import 'source-map-support/register';
import { getConfig } from '../../lib/Config';
import { app, checkUpdate, openDialog } from '../../lib/ipcWrapper';
import migration2to3 from '../../migration/migration2to3';
import core from './core';
import { EditorContextBridge } from './monacoEditorPreload';
import packageMain from './package';
import setting from './setting';

const config = getConfig();

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
    const input = document.getElementById(
      'installation-path',
    ) as HTMLInputElement | null;
    const instPath = input?.value ?? '';
    await packageMain.setPackagesList(instPath);
    await packageMain.displayNicommonsIdList(instPath);
  },
});

// メインワールドの React(Plugins タブ PackagesTab)とレガシーの橋渡し
contextBridge.exposeInMainWorld('packagesBridge', {
  setSelectedEntry: (type: string, entry: unknown) => {
    packageMain.setSelectedEntry(
      type,
      entry as Parameters<typeof packageMain.setSelectedEntry>[1],
    );
  },
  installPackageById: async (packageId: string) => {
    const input = document.getElementById(
      'installation-path',
    ) as HTMLInputElement | null;
    await packageMain.installPackageById(input?.value ?? '', packageId);
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
  // migration
  if (!(await migration2to3.global())) {
    await app.quit();
    return;
  }

  // init
  const firstLaunch = !config.dataURL.hasMain();
  await setting.initSettings();
  await core.initCore();

  // *local*
  const instPath = config.getInstallationPath();
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

  const batchInstallBtn = document.getElementById('batch-install');
  batchInstallBtn.addEventListener('click', async () => {
    await core.batchInstall(installationPath.value);
  });

  // packages
  const checkPackagesListBtn = document.getElementById('check-packages-list');
  checkPackagesListBtn.addEventListener('click', async () => {
    await packageMain.checkPackagesList(installationPath.value);
  });

  const installPackageBtn = document.getElementById('install-package');
  installPackageBtn.addEventListener('click', async () => {
    await packageMain.installPackage(installationPath.value);
  });

  const uninstallPackageBtn = document.getElementById('uninstall-package');
  uninstallPackageBtn.addEventListener('click', async () => {
    await packageMain.uninstallPackage(installationPath.value);
  });

  const openPackageFolderBtn = document.getElementById('open-package-folder');
  openPackageFolderBtn.addEventListener('click', async () => {
    await packageMain.openPackageFolder();
  });

  // フィルタボタンのクリックは React 側(packages/PackagesTab.tsx)が購読する

  const sharePackagesBtn = document.getElementById('share-packages');
  sharePackagesBtn.addEventListener('click', async () => {
    await packageMain.sharePackages(installationPath.value);
  });

  // nicommons ID
  new ClipboardJS('#copy-nicommons-id-textarea');

  // settings(UI は React 化済み。手動更新まわりのみ残る)
  const checkApmUpdateBtn = document.getElementById('check-apm-update');
  checkApmUpdateBtn.addEventListener('click', async () => {
    await checkUpdate();
  });
});
