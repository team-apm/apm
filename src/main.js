const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  shell,
} = require('electron');
const { download } = require('electron-dl');
const log = require('electron-log');
const fs = require('fs-extra');
const path = require('path');

if (require('electron-squirrel-startup')) app.quit();

require('update-electron-app')();

const isDevEnv = process.env.NODE_ENV === 'development';
if (isDevEnv) app.setPath('userData', app.getPath('userData') + '_Dev');

const Store = require('electron-store');
Store.initRenderer();

log.debug(process.versions);

let splashWindow;

/**
 * @function createSplash
 */
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 640,
    height: 360,
    center: true,
    frame: false,
    show: false,
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));

  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });
}

let mainWindow;

/**
 * @function createWindow
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.match(/^http/)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.match(/^http/)) {
      shell.openExternal(details.url);
    }
    return { action: 'deny' };
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', (event) => {
    if (browserWindow) {
      browserWindow.destroy();
    }
  });
}

let browserWindow;

/**
 * @function createBrowser
 * @param {string} url - A URL to open.
 */
function createBrowser(url) {
  browserWindow = new BrowserWindow({
    width: 800,
    height: 600,
    sandbox: true,
    parent: mainWindow,
    modal: true,
  });

  browserWindow.loadURL(url);
}

ipcMain.handle('get-app-version', (event) => {
  return app.getVersion();
});

ipcMain.handle('exists-temp-file', (event, relativePath) => {
  const filePath = path.join(app.getPath('userData'), 'Data/', relativePath);
  return { exists: fs.existsSync(filePath), path: filePath };
});

ipcMain.handle(
  'download',
  async (event, url, isTempData = false, tempSubDir = '') => {
    const ext = isTempData && path.extname(url);
    const win = BrowserWindow.getFocusedWindow();

    const opt = {};
    if (isTempData) {
      const directory = path.join(app.getPath('userData'), 'Data/', tempSubDir);

      if (ext === '.zip') {
        opt.directory = path.join(directory, 'archive');
      } else {
        opt.directory = directory;
      }

      const filePath = path.join(opt.directory, path.basename(url));

      if (fs.existsSync(filePath)) {
        if (ext === '.xml') {
          fs.unlinkSync(filePath);
        } else {
          return filePath;
        }
      }
    }

    const item = await download(win, url, opt);
    return item.getSavePath();
  }
);

ipcMain.handle('open-dir-dialog', async (event, title, defaultPath) => {
  const win = BrowserWindow.getFocusedWindow();
  const dir = await dialog.showOpenDialog(win, {
    title: title,
    defaultPath: defaultPath,
    properties: ['openDirectory'],
  });
  return dir.filePaths;
});

ipcMain.handle('open-err-dialog', async (event, title, message) => {
  const win = BrowserWindow.getFocusedWindow();
  await dialog.showMessageBox(win, {
    title: title,
    message: message,
    type: 'error',
  });
});

ipcMain.handle('open-browser', async (event, url, type) => {
  createBrowser(url);

  return await new Promise((resolve) => {
    browserWindow.webContents.session.on(
      'will-download',
      (event, item, webContents) => {
        const ext = path.extname(item.getFilename());
        const dir = path.join(app.getPath('userData'), 'Data');
        if (ext === '.zip') {
          item.setSavePath(
            path.join(dir, type, 'archive/', item.getFilename())
          );
        } else {
          item.setSavePath(path.join(dir, type, item.getFilename()));
        }

        item.once('done', (e, state) => {
          resolve(item.getSavePath());
        });
        browserWindow.hide();
      }
    );
  });
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

  createSplash();
  createWindow();

  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      mainWindow.show();
      splashWindow.hide();
      splashWindow.destroy();
    }, 2000);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
