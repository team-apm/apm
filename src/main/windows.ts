import { BrowserWindow, ipcMain, Menu, nativeTheme, shell } from 'electron';
import { createIPCHandler } from 'electron-trpc/main';
import windowStateKeeper from 'electron-window-state';
import path from 'node:path';
import { IPC_CHANNELS } from '../common/ipc';
import type Config from '../lib/Config';
import { setAboutWindowOpener } from './aboutWindow';
import { createContext, router } from './api';
import { runAutoUpdate } from './services/appUpdate';
import { openBrowser } from './services/browser';

declare const SPLASH_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const ABOUT_WINDOW_WEBPACK_ENTRY: string;
declare const ABOUT_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const isDevEnv = process.env.NODE_ENV === 'development';

const icon =
  process.platform === 'linux'
    ? path.join(__dirname, '../icon/apm1024.png')
    : undefined;

/**
 * Launch the app.
 * @param {Config} config - The config instance.
 */
export async function launch(config: Config) {
  await runAutoUpdate(config, isDevEnv);

  const splashWindow = new BrowserWindow({
    width: 640,
    height: 360,
    center: true,
    frame: false,
    show: false,
    icon: icon,
  });

  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });

  void splashWindow.loadURL(SPLASH_WINDOW_WEBPACK_ENTRY);

  const mainWindowState = windowStateKeeper({
    defaultWidth: 800,
    defaultHeight: 600,
  });

  const getTitleBarColor = () => {
    return {
      color: nativeTheme.shouldUseDarkColors ? '#2b3035' : '#f8f9fa',
      symbolColor: nativeTheme.shouldUseDarkColors ? '#dee2e6' : '#212529',
    };
  };

  const mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 320,
    minHeight: 240,
    show: false,
    icon: icon,
    titleBarStyle: 'hidden',
    titleBarOverlay: getTitleBarColor(),
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      sandbox: false,
    },
  });

  // ipcMain へのリスナー登録は 1 回だけにし、窓の追加は attachWindow で行う
  // (窓を開くたびに createIPCHandler を呼ぶとリスナーが重複する)
  const ipcHandler = createIPCHandler({
    router,
    createContext,
    windows: [mainWindow],
  });

  Menu.setApplicationMenu(null);

  mainWindow.webContents.on('will-navigate', async (event, url) => {
    if (url.match(/^http/)) {
      event.preventDefault();
      await shell.openExternal(url);
    }
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.match(/^http/)) {
      void shell.openExternal(details.url);
    }
    return { action: 'deny' };
  });

  nativeTheme.on('updated', () => {
    mainWindow.setTitleBarOverlay(getTitleBarColor());
  });

  mainWindow.once('show', () => {
    mainWindowState.manage(mainWindow);
  });

  setAboutWindowOpener(() => {
    const aboutPath = ABOUT_WINDOW_WEBPACK_ENTRY;
    const aboutWindow = new BrowserWindow({
      width: 480,
      height: 360,
      frame: false,
      resizable: false,
      modal: true,
      parent: mainWindow,
      icon: icon,
      webPreferences: {
        preload: ABOUT_WINDOW_PRELOAD_WEBPACK_ENTRY,
        sandbox: false,
      },
    });
    ipcHandler.attachWindow(aboutWindow);
    aboutWindow.once('close', () => {
      if (!aboutWindow.isDestroyed()) {
        aboutWindow.destroy();
      }
    });
    aboutWindow.once('ready-to-show', () => {
      aboutWindow.show();
    });
    void aboutWindow.loadURL(aboutPath);
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_BROWSER, async (event, url, type) => {
    // 実装は services/browser.ts へ抽出済み(main 内部からも呼べるようにするため)
    return await openBrowser(mainWindow, url, type);
  });

  setTimeout(() => {
    mainWindow.show();
    splashWindow.hide();
    splashWindow.destroy();
  }, 2000);

  void mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
}
