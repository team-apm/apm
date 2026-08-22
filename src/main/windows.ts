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

// 窓ごとの *_VITE_DEV_SERVER_URL / *_VITE_NAME は plugin-vite がビルド時に
// 埋め込む定数(型は src/types/forge-vite.d.ts)。dev サーバの URL は
// serve のときだけ値を持ち、production ビルドでは undefined になる

const isDevEnv = process.env.NODE_ENV === 'development';

/**
 * Loads a renderer entry point into the given window.
 * dev は Vite の dev サーバ、production は `.vite/renderer/{name}/index.html`
 * (`.vite/build` にある main から見た相対位置)。
 * @param {BrowserWindow} window - The window to load into.
 * @param {string | undefined} devServerUrl - The dev server URL, if serving.
 * @param {string} name - The renderer entry point name.
 */
function loadRenderer(
  window: BrowserWindow,
  devServerUrl: string | undefined,
  name: string,
) {
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(
      path.join(__dirname, '../renderer', name, 'index.html'),
    );
  }
}

/**
 * Returns the path of a preload script built into `.vite/build`.
 * @param {string} name - The preload output name (without extension).
 * @returns {string} The absolute path of the preload script.
 */
function preloadPath(name: string): string {
  return path.join(__dirname, `${name}.js`);
}

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

  loadRenderer(
    splashWindow,
    SPLASH_WINDOW_VITE_DEV_SERVER_URL,
    SPLASH_WINDOW_VITE_NAME,
  );

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
      preload: preloadPath('main_preload'),
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
    const aboutWindow = new BrowserWindow({
      width: 480,
      height: 360,
      frame: false,
      resizable: false,
      modal: true,
      parent: mainWindow,
      icon: icon,
      webPreferences: {
        preload: preloadPath('about_preload'),
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
    loadRenderer(
      aboutWindow,
      ABOUT_WINDOW_VITE_DEV_SERVER_URL,
      ABOUT_WINDOW_VITE_NAME,
    );
  });

  setTimeout(() => {
    mainWindow.show();
    splashWindow.hide();
    splashWindow.destroy();
  }, 2000);

  loadRenderer(
    mainWindow,
    MAIN_WINDOW_VITE_DEV_SERVER_URL,
    MAIN_WINDOW_VITE_NAME,
  );
}
