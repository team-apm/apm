const Store = require('electron-store');
const store = new Store();
const core = require('./core/core');
const plugin = require('./plugin/plugin');
const setting = require('./setting/setting');

window.addEventListener('DOMContentLoaded', () => {
  const installationPath = document.getElementById('installation-path');
  installationPath.setAttribute('value', store.get('installationPath', ''));

  // init data
  setting.initSettings();
  plugin.initPlugin(installationPath.value);

  // load data
  const dataURL = document.getElementById('data-url');
  dataURL.setAttribute('value', setting.getDataUrl());
  const extraDataURL = document.getElementById('extra-data-url');
  extraDataURL.value = setting.getExtraDataUrl();

  core.displayInstalledVersion(installationPath.value);
  core.setCoreVersions();
  plugin.setPluginsList(installationPath.value);

  const zoomFactorSelect = document.getElementById('zoom-factor-select');
  setting.setZoomFactor(zoomFactorSelect);
});

window.addEventListener('load', () => {
  // core
  const checkCoreVersionBtn = document.getElementById('check-core-version');
  checkCoreVersionBtn.addEventListener('click', (event) => {
    core.checkLatestVersion(checkCoreVersionBtn);
  });

  const selectInstallationPathBtn = document.getElementById(
    'select-installation-path'
  );
  const installationPath = document.getElementById('installation-path');
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

  // plugins
  const checkPluginsListBtn = document.getElementById('check-plugins-list');
  const pluginsTableOverlay = document.getElementById('plugins-table-overlay');
  checkPluginsListBtn.addEventListener('click', (event) => {
    plugin.checkPluginsList(
      checkPluginsListBtn,
      pluginsTableOverlay,
      installationPath.value
    );
  });

  const installPluginBtn = document.getElementById('install-plugin');
  installPluginBtn.addEventListener('click', (event) => {
    plugin.installPlugin(installPluginBtn, installationPath.value);
  });

  const uninstallPluginBtn = document.getElementById('uninstall-plugin');
  uninstallPluginBtn.addEventListener('click', (event) => {
    plugin.uninstallPlugin(uninstallPluginBtn, installationPath.value);
  });

  // settings
  const setDataUrlBtn = document.getElementById('set-data-url');
  const dataURL = document.getElementById('data-url');
  setDataUrlBtn.addEventListener('click', (event) => {
    setting.setDataUrl(setDataUrlBtn, dataURL.value);
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
