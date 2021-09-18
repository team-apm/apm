const Store = require('electron-store');
const store = new Store();
const core = require('./core/core');
const package = require('./package/package');
const setting = require('./setting/setting');

window.addEventListener('DOMContentLoaded', async () => {
  const installationPath = document.getElementById('installation-path');
  installationPath.value = store.get('installationPath', '');

  // init data
  const firstLaunch = !store.has('dataURL.main');
  setting.initSettings();
  package.initPackage(installationPath.value);
  if (firstLaunch) {
    const checkCoreVersionBtn = document.getElementById('check-core-version');
    await core.checkLatestVersion(checkCoreVersionBtn, installationPath.value);

    const checkPackagesListBtn = document.getElementById('check-packages-list');
    const packagesTableOverlay = document.getElementById(
      'packages-table-overlay'
    );
    await package.checkPackagesList(
      checkPackagesListBtn,
      packagesTableOverlay,
      installationPath.value
    );
  }

  // load data
  const dataURL = document.getElementById('data-url');
  dataURL.value = setting.getDataUrl();
  const extraDataURL = document.getElementById('extra-data-url');
  extraDataURL.value = setting.getExtraDataUrl();

  await core.displayInstalledVersion(installationPath.value);
  await core.setCoreVersions();
  await package.setPackagesList(installationPath.value);

  const zoomFactorSelect = document.getElementById('zoom-factor-select');
  setting.setZoomFactor(zoomFactorSelect);
});

window.addEventListener('load', () => {
  const installationPath = document.getElementById('installation-path');

  // core
  const checkCoreVersionBtn = document.getElementById('check-core-version');
  checkCoreVersionBtn.addEventListener('click', async (event) => {
    await core.checkLatestVersion(checkCoreVersionBtn, installationPath.value);
  });

  const selectInstallationPathBtn = document.getElementById(
    'select-installation-path'
  );
  selectInstallationPathBtn.addEventListener('click', async (event) => {
    await core.selectInstallationPath(installationPath);
  });

  const installAviutlBtn = document.getElementById('install-aviutl');
  const aviutlVersionSelect = document.getElementById('aviutl-version-select');
  installAviutlBtn.addEventListener('click', async (event) => {
    await core.installProgram(
      installAviutlBtn,
      'aviutl',
      aviutlVersionSelect.value,
      installationPath.value
    );
  });

  const installExeditBtn = document.getElementById('install-exedit');
  const exeditVersionSelect = document.getElementById('exedit-version-select');
  installExeditBtn.addEventListener('click', async (event) => {
    await core.installProgram(
      installExeditBtn,
      'exedit',
      exeditVersionSelect.value,
      installationPath.value
    );
  });

  // packages
  const checkPackagesListBtn = document.getElementById('check-packages-list');
  const packagesTableOverlay = document.getElementById(
    'packages-table-overlay'
  );
  checkPackagesListBtn.addEventListener('click', async (event) => {
    await package.checkPackagesList(
      checkPackagesListBtn,
      packagesTableOverlay,
      installationPath.value
    );
  });

  const installPackageBtn = document.getElementById('install-package');
  installPackageBtn.addEventListener('click', async (event) => {
    await package.installPackage(installPackageBtn, installationPath.value);
  });

  const uninstallPackageBtn = document.getElementById('uninstall-package');
  uninstallPackageBtn.addEventListener('click', async (event) => {
    await package.uninstallPackage(uninstallPackageBtn, installationPath.value);
  });

  const openPackageFolderBtn = document.getElementById('open-package-folder');
  openPackageFolderBtn.addEventListener('click', async (event) => {
    await package.openPackageFolder(
      openPackageFolderBtn,
      installationPath.value
    );
  });

  const filterDropdown = document.getElementById('filter').parentElement;
  const typeFilterBtns = filterDropdown.getElementsByClassName('type-filter');
  for (const element of typeFilterBtns) {
    element.addEventListener('click', () => {
      package.listFilter('type', typeFilterBtns, element);
    });
  }
  const installFilterBtns =
    filterDropdown.getElementsByClassName('install-filter');
  for (const element of installFilterBtns) {
    element.addEventListener('click', () => {
      package.listFilter('installedVersion', installFilterBtns, element);
    });
  }

  // settings
  const setDataUrlBtn = document.getElementById('set-data-url');
  const dataURL = document.getElementById('data-url');
  setDataUrlBtn.addEventListener('click', (event) => {
    setting.setDataUrl(setDataUrlBtn, dataURL);
  });

  const setExtraDataUrlBtn = document.getElementById('set-extra-data-url');
  const extraDataURL = document.getElementById('extra-data-url');
  setExtraDataUrlBtn.addEventListener('click', (event) => {
    setting.setExtraDataUrl(setExtraDataUrlBtn, extraDataURL.value);
  });

  const zoomFactorSelect = document.getElementById('zoom-factor-select');
  zoomFactorSelect.addEventListener('input', (event) => {
    setting.changeZoomFactor(zoomFactorSelect.value);
  });
});
