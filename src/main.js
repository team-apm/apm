const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

/**
 * @function createWindow
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.on('get-app-version', (event) => {
  event.sender.send('got-app-version', app.getVersion());
});
const template = [
  {
    label: 'apm',
    submenu: [
      {
        label: `${app.name}について`,
        click: () => {
          const aboutPath = path.join(__dirname, 'about.html');
          let aboutWindow = new BrowserWindow({
            width: 360,
            height: 240,
            frame: false,
            resizable: false,
            modal: true,
            parent: mainWindow,
            webPreferences: {
              preload: path.join(__dirname, 'about_preload.js'),
            },
          });
          aboutWindow.on('close', () => {
            aboutWindow = null;
          });
          aboutWindow.loadFile(aboutPath);
          aboutWindow.show();
        },
      },
      {
        role: 'toggleDevTools',
        visible: false,
      },
      {
        label: '終了',
        click: () => {
          app.quit();
        },
      },
    ],
  },
];

app.whenReady().then(() => {
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
