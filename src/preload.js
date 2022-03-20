import { ipcRenderer } from 'electron';
import Store from 'electron-store';
const store = new Store();
import log from 'electron-log';
import core from './core/core';
import packageMain from './package/package';
import setting from './setting/setting';
import migration1to2 from './migration/migration1to2';

log.catchErrors({
  onError: () => {
    ipcRenderer.invoke(
      'open-err-dialog',
      'エラー',
      `予期しないエラーが発生しました。\nログファイル: ${
        log.transports.file.getFile().path
      }`
    );
  },
});

window.addEventListener('DOMContentLoaded', async () => {
  // *global*
  // migration
  if (!(await migration1to2.global())) {
    await ipcRenderer.invoke('app-quit');
    return;
  }

  // init
  const firstLaunch = !store.has('dataURL.main');
  await setting.initSettings();
  await core.initCore();

  // *local*
  const instPath = store.get('installationPath', '');
  await core.changeInstallationPath(instPath);

  // *UI*
  // init
  if (firstLaunch) {
    const tutorialAlert = document.getElementById('tutorial-alert');
    tutorialAlert.classList.remove('d-none');
  }
  const installationPath = document.getElementById('installation-path');
  installationPath.value = instPath;
  const dataURL = document.getElementById('data-url');
  dataURL.value = setting.getDataUrl();
  const extraDataURL = document.getElementById('extra-data-url');
  extraDataURL.value = setting.getExtraDataUrl();
  const zoomFactorSelect = document.getElementById('zoom-factor-select');
  setting.setZoomFactor(zoomFactorSelect);
});

window.addEventListener('load', () => {
  const installationPath = document.getElementById('installation-path');

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
  const typeFilterBtns = filterDropdown.getElementsByClassName('type-filter');
  for (const element of typeFilterBtns) {
    element.addEventListener('click', () => {
      packageMain.listFilter('type', typeFilterBtns, element);
    });
  }
  const installFilterBtns =
    filterDropdown.getElementsByClassName('install-filter');
  for (const element of installFilterBtns) {
    element.addEventListener('click', () => {
      packageMain.listFilter('installationStatus', installFilterBtns, element);
    });
  }

  // settings
  const setDataUrlBtn = document.getElementById('set-data-url');
  const dataURL = document.getElementById('data-url');
  const extraDataURL = document.getElementById('extra-data-url');
  setDataUrlBtn.addEventListener('click', async () => {
    await setting.setDataUrl(dataURL, extraDataURL.value);
  });

  const zoomFactorSelect = document.getElementById('zoom-factor-select');
  zoomFactorSelect.addEventListener('input', () => {
    setting.changeZoomFactor(zoomFactorSelect.value);
  });
});
