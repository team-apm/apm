const Store = require('electron-store');
const store = new Store();

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };
  for (const program of ['aviutl', 'exedit']) {
    replaceText(
      `${program}-version`,
      store.get('installedVersion[program]', '未インストール')
    );
  }
});
