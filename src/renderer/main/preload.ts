import ClipboardJS from 'clipboard/src/clipboard';
import log from 'electron-log';
import Store from 'electron-store';
import {
  app,
  checkUpdate,
  isExeVersion,
  openAboutWindow,
  openDialog,
  openGitHubIssue,
  openGoogleForm,
  openPackageMaker,
} from '../../lib/ipcWrapper';
import * as modList from '../../lib/modList';
import migration2to3 from '../../migration/migration2to3';
import core from './core';
import packageMain from './package';
import setting from './setting';
const store = new Store();

log.catchErrors({
  onError: () => {
    openDialog(
      'エラー',
      `予期しないエラーが発生しました。\nログファイル: ${
        log.transports.file.getFile().path
      }`,
      'error'
    );
  },
});

window.addEventListener('DOMContentLoaded', async () => {
  // *global*
  // migration
  if (!(await migration2to3.global())) {
    await app.quit();
    return;
  }

  // init
  const firstLaunch = !store.has('dataURL.main');
  await setting.initSettings();
  await core.initCore();

  // *local*
  const instPath = store.get('installationPath', '') as string;
  await core.changeInstallationPath(instPath);

  // *UI*
  // init
  if (firstLaunch) {
    const tutorialAlert = document.getElementById('tutorial-alert');
    tutorialAlert.classList.remove('d-none');
  }
  const installationPath = document.getElementById(
    'installation-path'
  ) as HTMLInputElement;
  installationPath.value = instPath;
  const dataURL = document.getElementById('data-url') as HTMLInputElement;
  dataURL.value = modList.getDataUrl();
  const extraDataURL = document.getElementById(
    'extra-data-url'
  ) as HTMLInputElement;
  extraDataURL.value = modList.getExtraDataUrl();
  const zoomFactorSelect = document.getElementById(
    'zoom-factor-select'
  ) as HTMLSelectElement;
  setting.setZoomFactor(zoomFactorSelect);

  const doAutoUpdate = store.get('autoUpdate');
  const autoUpdateRadios = document.getElementsByName('auto-update');
  autoUpdateRadios.forEach((element: HTMLInputElement) => {
    if (element instanceof HTMLInputElement)
      if (element.value === doAutoUpdate) {
        element.checked = true;
      }
  });
  if (!(await isExeVersion())) {
    const e = document.getElementById('auto-update-download');
    if (e instanceof HTMLInputElement) e.disabled = true;
  }

  const appName = document.getElementsByClassName('app-name');
  for (let i = 0; i < appName.length; i++) {
    const element = appName.item(i) as HTMLSpanElement;
    element.innerText = await app.getName();
  }
});

window.addEventListener('load', () => {
  const installationPath = document.getElementById(
    'installation-path'
  ) as HTMLInputElement;

  // core
  const checkCoreVersionBtn = document.getElementById('check-core-version');
  checkCoreVersionBtn.addEventListener('click', async () => {
    await core.checkLatestVersion(installationPath.value);
  });

  const selectInstallationPathBtn = document.getElementById(
    'select-installation-path'
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

  const filterDropdown = document.getElementById('filter').parentElement;
  const typeFilterBtns = filterDropdown.getElementsByClassName(
    'type-filter'
  ) as HTMLCollectionOf<HTMLButtonElement>;
  Array.from(typeFilterBtns).forEach((element: HTMLButtonElement) => {
    element.addEventListener('click', () => {
      packageMain.listFilter('type', typeFilterBtns, element);
    });
  });
  const installFilterBtns = filterDropdown.getElementsByClassName(
    'install-filter'
  ) as HTMLCollectionOf<HTMLButtonElement>;
  Array.from(installFilterBtns).forEach((element: HTMLButtonElement) => {
    element.addEventListener('click', () => {
      packageMain.listFilter('installationStatus', installFilterBtns, element);
    });
  });

  // nicommons ID
  new ClipboardJS('#copy-nicommons-id-textarea');

  // settings
  const setDataUrlBtn = document.getElementById('set-data-url');
  const dataURL = document.getElementById('data-url') as HTMLInputElement;
  const extraDataURL = document.getElementById(
    'extra-data-url'
  ) as HTMLInputElement;
  setDataUrlBtn.addEventListener('click', async () => {
    await setting.setDataUrl(dataURL, extraDataURL.value);
  });

  const zoomFactorSelect = document.getElementById(
    'zoom-factor-select'
  ) as HTMLInputElement;
  zoomFactorSelect.addEventListener('input', () => {
    setting.changeZoomFactor(zoomFactorSelect.value);
  });

  const checkApmUpdateBtn = document.getElementById('check-apm-update');
  checkApmUpdateBtn.addEventListener('click', () => {
    checkUpdate();
  });

  const autoUpdateRadios = document.getElementsByName('auto-update');
  autoUpdateRadios.forEach((element: HTMLInputElement) => {
    element.addEventListener('change', () => {
      store.set('autoUpdate', element.value);
    });
  });

  // About / Others
  const openAboutWindonBtn = document.getElementById('open-about-window');
  openAboutWindonBtn.addEventListener('click', () => {
    openAboutWindow();
  });

  const openGithubIssueBtn = document.getElementById('open-github-issue');
  openGithubIssueBtn.addEventListener('click', () => {
    openGitHubIssue();
  });

  const openGoogleFormBtn = document.getElementById('open-google-form');
  openGoogleFormBtn.addEventListener('click', () => {
    openGoogleForm();
  });

  const openPackageMakerBtn = document.getElementById('open-package-maker');
  openPackageMakerBtn.addEventListener('click', () => {
    openPackageMaker();
  });

  const exitAppBtn = document.getElementById('quit-app');
  exitAppBtn.addEventListener('click', () => {
    app.quit();
  });
});
