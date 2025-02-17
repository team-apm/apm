import { BrowserWindow, dialog } from 'electron';

/**
 * Displays a confirmation dialog with the given title and message.
 * @param {string} title - The title of the confirmation dialog.
 * @param {string} message - The message to display in the confirmation dialog.
 * @returns {Promise<boolean>} - A promise that resolves to `true` if the user selects 'はい', and `false` if the user selects 'いいえ'.
 */
async function showConfirmationDialog(title: string, message: string) {
  const win = BrowserWindow.getFocusedWindow();
  const response = await dialog.showMessageBox(win, {
    title: title,
    message: message,
    type: 'warning',
    buttons: ['はい', `いいえ`],
    cancelId: 1,
  });
  if (response.response === 0) {
    return true;
  } else {
    return false;
  }
}

export default showConfirmationDialog;
