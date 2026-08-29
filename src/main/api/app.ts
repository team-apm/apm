import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  type OpenDialogOptions,
  shell,
} from 'electron';
import log from 'electron-log/main';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { openAboutWindow } from '../aboutWindow';
import {
  checkUpdate as checkAppUpdate,
  isExeVersion,
} from '../services/appUpdate';
import { procedure } from './trpc';

// trpc-electron は falsy なトップレベル入力('' 含む)を undefined に変換する
// ため、文字列もオブジェクトで包んで受け取る
const clipboardInput = (value: unknown): { text: string } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { text } = value as Record<string, unknown>;
  if (typeof text !== 'string')
    throw new TypeError('text is expected to be a string.');
  return { text };
};

const DIALOG_TYPES = ['none', 'info', 'error', 'question', 'warning'] as const;
const dialogInput = (
  value: unknown,
): { title: string; message: string; type: (typeof DIALOG_TYPES)[number] } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { title, message, type } = value as Record<string, unknown>;
  if (
    typeof title !== 'string' ||
    typeof message !== 'string' ||
    typeof type !== 'string' ||
    !(DIALOG_TYPES as readonly string[]).includes(type)
  )
    throw new TypeError('title, message, and a valid type are expected.');
  return { title, message, type: type as (typeof DIALOG_TYPES)[number] };
};

const dirDialogInput = (
  value: unknown,
): { title: string; defaultPath: string } => {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('An object is expected.');
  const { title, defaultPath } = value as Record<string, unknown>;
  if (typeof title !== 'string' || typeof defaultPath !== 'string')
    throw new TypeError('title and defaultPath are expected.');
  return { title, defaultPath };
};

// ルート直下(サブルーターに属さない)のアプリ全般 procedure 群
export const appProcedures = {
  getAppVersion: procedure.query(async () => {
    return app.getVersion();
  }),
  // About 窓の表示用。renderer の process.versions と同じ値が main でも取れる
  // ため、contextBridge での露出(旧 window.process)は使わない
  getProcessVersions: procedure.query(() => ({
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  })),
  isExeVersion: procedure.query(() => isExeVersion()),
  getAppName: procedure.query(() => app.getName()),
  quitApp: procedure.mutation(() => {
    app.quit();
  }),
  openAboutWindow: procedure.mutation(() => {
    openAboutWindow();
  }),
  // バグ報告に添えるログへの導線。場所は app.getPath('logs') で組み立てず
  // electron-log 自身に聞く(transports.file の設定を変えても追従する)
  openLogFolder: procedure.mutation(async () => {
    const logPath = log.transports.file.getFile().path;
    // 添付するのはファイルなので、選択した状態でフォルダを開く。
    // 起動時に必ず 1 行書くので通常は存在するが、書き込みに失敗している
    // ときこそ開きたいので、無ければフォルダだけ開く
    if (existsSync(logPath)) {
      shell.showItemInFolder(logPath);
      return;
    }
    await shell.openPath(path.dirname(logPath));
  }),
  openDialog: procedure.input(dialogInput).mutation(async ({ input }) => {
    await dialog.showMessageBox({
      title: input.title,
      message: input.message,
      type: input.type,
    });
  }),
  // フォルダ選択ダイアログ(旧 OPEN_DIR_DIALOG チャンネルと同一の挙動)
  openDirDialog: procedure.input(dirDialogInput).mutation(async ({ input }) => {
    const options: OpenDialogOptions = {
      title: input.title,
      defaultPath: input.defaultPath,
      properties: ['openDirectory'],
    };
    // フォーカス窓が無いときは窓なしのオーバーロードへ回す。null を親として
    // 渡す書き方は型が許さず、すぐ上の openDialog も窓なしで呼んでいる
    const win = BrowserWindow.getFocusedWindow();
    const dir = await (win
      ? dialog.showOpenDialog(win, options)
      : dialog.showOpenDialog(options));
    return dir.filePaths;
  }),
  writeClipboardText: procedure.input(clipboardInput).mutation(({ input }) => {
    clipboard.writeText(input.text);
  }),
  // 手動更新テーブル(React)の apm 更新ボタン。silent = false で
  // 「最新版です」のダイアログまで main 側が表示する
  checkUpdate: procedure.mutation(async () => {
    await checkAppUpdate(false);
  }),
};
