import { dialog, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../common/ipc';

/**
 * Registers the legacy IPC handlers used by the preload scripts.
 * メインワールドの renderer は tRPC(api/app.ts の openDialog)を使う。
 * ここに残るのは preload のエラーハンドラ専用チャンネルのみ(src/common/ipc.ts)
 */
export function registerIpcHandlers() {
  ipcMain.handle(
    IPC_CHANNELS.OPEN_DIALOG,
    async (event, title, message, type) => {
      await dialog.showMessageBox({
        title: title,
        message: message,
        type: type,
      });
    },
  );
}
