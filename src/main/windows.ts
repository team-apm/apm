import {
  BrowserWindow,
  Menu,
  nativeTheme,
  shell,
  type WebContents,
} from 'electron';
import windowStateKeeper from 'electron-window-state';
import path from 'node:path';
import { createIPCHandler } from 'trpc-electron/main';
import { setAboutWindowOpener } from './aboutWindow';
import { createContext, router } from './api';
import type Config from './Config';
import { runAutoUpdate } from './services/appUpdate';

declare const SPLASH_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const ABOUT_WINDOW_WEBPACK_ENTRY: string;
declare const ABOUT_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const isDevEnv = process.env.NODE_ENV === 'development';

/**
 * Denies all in-window navigations and window creations, opening http(s)
 * URLs in the external browser instead.
 * @param {WebContents} contents - The webContents to harden.
 */
function hardenNavigation(contents: WebContents) {
  // アプリの窓は SPA で正当なページ内遷移が無いため、既定 deny にする。
  // スキーム判定を http(s):// 完全一致にするのは、/^http/ だと
  // httpevil: のような偽スキームまで外部ブラウザへ渡してしまうため
  contents.on('will-navigate', (event, url) => {
    event.preventDefault();
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
}

const icon =
  process.platform === 'linux'
    ? path.join(__dirname, '../icon/apm1024.png')
    : undefined;

// macOS では全窓を閉じてもアプリが生き残り、Dock からの activate で
// launch() が再実行される。trpc-electron の createIPCHandler は
// ipcMain.on で登録し解除 API が無いため、再実行のたびに作ると
// リスナーが純増して全リクエストが多重処理される(mutation の二重実行)。
// ハンドラはプロセスで 1 個だけ作り、窓は attachWindow で追加する
let ipcHandler: ReturnType<typeof createIPCHandler> | null = null;

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

  hardenNavigation(splashWindow.webContents);

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
      sandbox: true,
    },
  });

  if (ipcHandler) {
    ipcHandler.attachWindow(mainWindow);
  } else {
    ipcHandler = createIPCHandler({
      router,
      createContext,
      windows: [mainWindow],
    });
  }

  Menu.setApplicationMenu(null);

  hardenNavigation(mainWindow.webContents);

  const onThemeUpdated = () => {
    mainWindow.setTitleBarOverlay(getTitleBarColor());
  };
  nativeTheme.on('updated', onThemeUpdated);
  // 解除しないと launch() の再実行ごとにリスナーが溜まり、破棄済みの
  // mainWindow への setTitleBarOverlay で例外になる
  mainWindow.on('closed', () => {
    nativeTheme.removeListener('updated', onThemeUpdated);
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
        sandbox: true,
      },
    });
    // about 窓は従来ハンドラ未設定で、リンクを踏むと窓ごと外部サイトへ
    // 遷移できてしまっていた
    hardenNavigation(aboutWindow.webContents);
    ipcHandler?.attachWindow(aboutWindow);
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

  setTimeout(() => {
    mainWindow.show();
    splashWindow.hide();
    splashWindow.destroy();
  }, 2000);

  void mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
}
