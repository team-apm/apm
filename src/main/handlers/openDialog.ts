import { dialog } from 'electron';

/**
 * Open dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {'none' | 'info' | 'error' | 'question' | 'warning'} type - Dialog type
 */
async function openDialog(
  title: string,
  message: string,
  type: 'none' | 'info' | 'error' | 'question' | 'warning',
) {
  await dialog.showMessageBox({
    title: title,
    message: message,
    type: type,
  });
}

export default openDialog;
