import { app, BrowserWindow, clipboard, dialog } from 'electron';
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
  openDialog: procedure.input(dialogInput).mutation(async ({ input }) => {
    await dialog.showMessageBox({
      title: input.title,
      message: input.message,
      type: input.type,
    });
  }),
  // フォルダ選択ダイアログ(旧 OPEN_DIR_DIALOG チャンネルと同一の挙動)
  openDirDialog: procedure.input(dirDialogInput).mutation(async ({ input }) => {
    const win = BrowserWindow.getFocusedWindow();
    const dir = await dialog.showOpenDialog(win, {
      title: input.title,
      defaultPath: input.defaultPath,
      properties: ['openDirectory'],
    });
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
