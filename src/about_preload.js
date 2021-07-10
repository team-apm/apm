const { ipcRenderer } = require('electron');
const replaceText = require('./lib/replaceText');

window.addEventListener('click', () => {
  window.close();
});

window.addEventListener('DOMContentLoaded', async () => {
  const appVersion = await ipcRenderer.invoke('get-app-version');
  replaceText('app-version', appVersion);
  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }
});
