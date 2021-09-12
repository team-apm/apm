const Store = require('electron-store');
const store = new Store();
const core = require('./core/core');
const package = require('./package/package');
const setting = require('./setting/setting');

window.addEventListener('DOMContentLoaded', () => {
  const installationPath = document.getElementById('installation-path');
  installationPath.value = store.get('installationPath', '');

  // init data
  setting.initSettings();
  package.initPackage(installationPath.value);

  // load data
  const dataURL = document.getElementById('data-url');
  dataURL.value = setting.getDataUrl();
  const extraDataURL = document.getElementById('extra-data-url');
  extraDataURL.value = setting.getExtraDataUrl();

  core.displayInstalledVersion(installationPath.value);
  core.setCoreVersions();
  package.setPackagesList(installationPath.value);

  const zoomFactorSelect = document.getElementById('zoom-factor-select');
  setting.setZoomFactor(zoomFactorSelect);
});

window.addEventListener('load', () => {
  const installationPath = document.getElementById('installation-path');

  // core
  const checkCoreVersionBtn = document.getElementById('check-core-version');
  checkCoreVersionBtn.addEventListener('click', (event) => {
    core.checkLatestVersion(checkCoreVersionBtn, installationPath.value);
  });

  const selectInstallationPathBtn = document.getElementById(
    'select-installation-path'
  );
  selectInstallationPathBtn.addEventListener('click', (event) => {
    core.selectInstallationPath(installationPath);
  });

  const installAviutlBtn = document.getElementById('install-aviutl');
  const aviutlVersionSelect = document.getElementById('aviutl-version-select');
  installAviutlBtn.addEventListener('click', (event) => {
    core.installProgram(
      installAviutlBtn,
      'aviutl',
      aviutlVersionSelect.value,
      installationPath.value
    );
  });

  const installExeditBtn = document.getElementById('install-exedit');
  const exeditVersionSelect = document.getElementById('exedit-version-select');
  installExeditBtn.addEventListener('click', (event) => {
    core.installProgram(
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
  checkPackagesListBtn.addEventListener('click', (event) => {
    package.checkPackagesList(
      checkPackagesListBtn,
      packagesTableOverlay,
      installationPath.value
    );
  });

  const installPackageBtn = document.getElementById('install-package');
  installPackageBtn.addEventListener('click', (event) => {
    package.installPackage(installPackageBtn, installationPath.value);
  });

  const uninstallPackageBtn = document.getElementById('uninstall-package');
  uninstallPackageBtn.addEventListener('click', (event) => {
    package.uninstallPackage(uninstallPackageBtn, installationPath.value);
  });

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
