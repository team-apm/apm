const { ipcRenderer } = require('electron');

window.addEventListener('click', () => {
  window.close();
});

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };
  ipcRenderer.send('get-app-version');
  ipcRenderer.on('got-app-version', (event, version) => {
    replaceText('app-version', version);
  });
  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }
});
