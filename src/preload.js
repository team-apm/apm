const Store = require('electron-store');
const store = new Store();
const core = require('./core/core');
const plugin = require('./plugin/plugin');

window.addEventListener('DOMContentLoaded', () => {
  const installationPath = document.getElementById('installation-path');
  installationPath.setAttribute('value', store.get('installationPath', ''));

  core.displayInstalledVersion(installationPath.value);
  core.setCoreVersions();
  plugin.setPluginsList(installationPath.value);
});

window.addEventListener('load', () => {
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
});
