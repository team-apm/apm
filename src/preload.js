const { ipcRenderer } = require('electron');
const Store = require('electron-store');
const store = new Store();
const log = require('electron-log');
const core = require('./core/core');
const package = require('./package/package');
const setting = require('./setting/setting');
const mod = require('./lib/mod');

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
  const installationPath = document.getElementById('installation-path');
  const checkCoreVersionBtn = document.getElementById('check-core-version');
  const checkPackagesListBtn = document.getElementById('check-packages-list');
  const packagesTableOverlay = document.getElementById(
    'packages-table-overlay'
  );

  // init data
  const firstLaunch = !store.has('dataURL.main');
  setting.initSettings();
  await core.initCore();
  package.initPackage(
    document.getElementById('install-package'),
    document.getElementById('batch-install-packages')
  );
  installationPath.value = store.get('installationPath', '');

  // update data
  const oldCoreMod = new Date(store.get('modDate.core', 0));
  const oldPackagesMod = new Date(store.get('modDate.packages', 0));
  await mod.downloadData();
  const currentMod = await mod.getInfo();
  if (oldCoreMod.getTime() < currentMod.core.getTime()) {
    await core.checkLatestVersion(checkCoreVersionBtn, installationPath.value);
  }
  if (oldPackagesMod.getTime() < currentMod.packages.getTime()) {
    await package.checkPackagesList(
      checkPackagesListBtn,
      packagesTableOverlay,
      installationPath.value
    );
  }

  // tutorial
  if (firstLaunch) {
    const tutorialAlert = document.getElementById('tutorial-alert');
    tutorialAlert.classList.remove('d-none');
  }

  // load data
  const dataURL = document.getElementById('data-url');
  dataURL.value = setting.getDataUrl();
  const extraDataURL = document.getElementById('extra-data-url');
  extraDataURL.value = setting.getExtraDataUrl();

  await core.displayInstalledVersion(installationPath.value);
  await core.setCoreVersions(installationPath.value);
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

  const batchInstallBtn = document.getElementById('batch-install');
  batchInstallBtn.addEventListener('click', async (event) => {
    await core.batchInstall(batchInstallBtn, installationPath.value);
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

  const installScriptBtn = document.getElementById('install-script');
  const installScriptIndicationBtn = document.getElementById(
    'install-script-indication'
  );
  installScriptBtn.addEventListener('click', async (event) => {
    await package.installScript(
      installScriptIndicationBtn,
      installationPath.value,
      'https://hal-shu-sato.github.io/apm-data/install-script.html'
    );
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
