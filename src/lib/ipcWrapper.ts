import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../common/ipc';

/**
 * Opens an error dialog.
 * preload のエラーハンドラ専用(メインワールドは tRPC の openDialog を使う)
 * @param {string} title - A title of the dialog.
 * @param {string} message - A message showed in the dialog.
 * @param {'none' | 'info' | 'error' | 'question' | 'warning'} [type] - A type of the dialog.
 */
export async function openDialog(
  title: string,
  message: string,
  type?: 'none' | 'info' | 'error' | 'question' | 'warning',
) {
  await ipcRenderer.invoke(IPC_CHANNELS.OPEN_DIALOG, title, message, type);
}
