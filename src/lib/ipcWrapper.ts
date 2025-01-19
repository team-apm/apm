import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../common/ipc';

export const app = {
  /**
   * Gets the app's name.
   * @returns {Promise<string>} The app's name.
   */
  getName: async function () {
    return (await ipcRenderer.invoke(IPC_CHANNELS.GET_APP_NAME)) as string;
  },

  /**
   * Gets the app's version.
   * @returns {Promise<string>} The app's version.
   */
  getVersion: async function () {
    return (await ipcRenderer.invoke(IPC_CHANNELS.GET_APP_VERSION)) as string;
  },

  /**
   * Gets a path to a special directory or file associated with `name`.
   * @param {string} name - A name associated with a special directory or file you get.
   * @returns {Promise<string>} The path to the special directory or file.
   */
  getPath: async function (
    name:
      | 'home'
      | 'appData'
      | 'userData'
      | 'cache'
      | 'temp'
      | 'exe'
      | 'module'
      | 'desktop'
      | 'documents'
      | 'downloads'
      | 'music'
      | 'pictures'
      | 'videos'
      | 'recent'
      | 'logs'
      | 'crashDumps',
  ) {
    return (await ipcRenderer.invoke(
      IPC_CHANNELS.APP_GET_PATH,
      name,
    )) as string;
  },

  /**
   * Quits the app.
   */
  quit: async function () {
    await ipcRenderer.invoke(IPC_CHANNELS.APP_QUIT);
  },
};

/**
 * Whether the app is exe version.
 * @returns {Promise<boolean>} Whether the app is exe version.
 */
export async function isExeVersion() {
  return (await ipcRenderer.invoke(IPC_CHANNELS.IS_EXE_VERSION)) as boolean;
}

/**
 * Check the update of the app.
 */
export async function checkUpdate() {
  await ipcRenderer.invoke(IPC_CHANNELS.CHECK_UPDATE);
}

/**
 * Opens a file explorer and returns whether the directory exists.
 * @param {string} relativePath - A relative path from the data directory.
 * @returns {Promise<boolean>} Whether the directory exists.
 */
export async function openPath(relativePath: string) {
  return (await ipcRenderer.invoke(
    IPC_CHANNELS.OPEN_PATH,
    relativePath,
  )) as boolean;
}

/**
 * Returns whether the temporary file exists and the path.
 * @param {string} relativePath - A relative path from the data directory.
 * @param {string} [keyText] - String used to generate the hash.
 * @returns {Promise<{ exists: boolean; path: string }>} An object containing the existence status and the path.
 */
export async function existsTempFile(
  relativePath: string,
  keyText: string = undefined,
) {
  return (await ipcRenderer.invoke(
    IPC_CHANNELS.EXISTS_TEMP_FILE,
    relativePath,
    keyText,
  )) as { exists: boolean; path: string };
}

/**
 * Opens a directory dialog and returns the path selected by a user.
 * @param {string} title - A title of the dialog.
 * @param {string} defaultPath - A path of the initial directory.
 * @returns {Promise<string[]>} The path selected by the user.
 */
export async function openDirDialog(title: string, defaultPath: string) {
  return (await ipcRenderer.invoke(
    IPC_CHANNELS.OPEN_DIR_DIALOG,
    title,
    defaultPath,
  )) as string[];
}

/**
 * Opens a error dialog.
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

/**
 * Opens a yes-no dialog and returns a response.
 * @param {string} title - A title of the dialog.
 * @param {string} message - A message showed in the dialog.
 * @returns {Promise<boolean>} The user's response.
 */
export async function openYesNoDialog(title: string, message: string) {
  return (await ipcRenderer.invoke(
    IPC_CHANNELS.OPEN_YES_NO_DIALOG,
    title,
    message,
  )) as boolean;
}

/**
 * Gets nicommons' data.
 * @param {string} id - A nicommons ID.
 * @returns {Promise<unknown>} The nicommons data.
 */
export async function getNicommonsData(id: string) {
  return (await ipcRenderer.invoke(
    IPC_CHANNELS.GET_NICOMMONS_DATA,
    id,
  )) as unknown;
}

/**
 * Opens the about window.
 */
export async function openAboutWindow() {
  await ipcRenderer.invoke(IPC_CHANNELS.OPEN_ABOUT_WINDOW);
}

/**
 * Opens the confirm dialog for migration v1 to v2.
 * @returns {Promise<number>} The result of the dialog.
 */
export async function migration1to2ConfirmDialog() {
  return (await ipcRenderer.invoke(
    IPC_CHANNELS.MIGRATION1TO2_CONFIRM_DIALOG,
  )) as number;
}

/**
 * Opens the input dialog of a data url for migration v1 to v2.
 * @returns {Promise<string>} The data URL entered by the user.
 */
export async function migration1to2DataurlInputDialog() {
  return (await ipcRenderer.invoke(
    IPC_CHANNELS.MIGRATION1TO2_DATAURL_INPUT_DIALOG,
  )) as string;
}

/**
 * Changes the zoom factor of the main window.
 * @param {number} zoomFactor - A zoom factor to be changed to. Zoom factor is zoom percent divided by 100, so 300% = 3.0.
 */
export async function changeMainZoomFactor(zoomFactor: number) {
  await ipcRenderer.invoke(IPC_CHANNELS.CHANGE_MAIN_ZOOM_FACTOR, zoomFactor);
}

/**
 * Downloads a file.
 * @param {string} url - The URL of a file to download.
 * @param {object} [options] - Options
 * @param {boolean} [options.loadCache] - Whether to load a cache file.
 * @param {string} [options.subDir] - A directory name under a data directory.
 * @param {string} [options.keyText] - String used to generate the hash.
 * @returns {Promise<string>} File path (on success) or undefined (on failure).
 */
export async function download(
  url: string,
  options?: { loadCache?: boolean; subDir?: string; keyText?: string },
) {
  return (await ipcRenderer.invoke(
    IPC_CHANNELS.DOWNLOAD,
    url,
    options,
  )) as string;
}

/**
 * Opens the browser window.
 * @param {string} url - A URL to be opened.
 * @param {'core'|'package'} type - A type of the file to be downloaded.
 * @returns {Promise<{ savePath: string; history: string[] } | null>} The save path and history, or null if failed.
 */
export async function openBrowser(url: string, type: 'core' | 'package') {
  return (await ipcRenderer.invoke(IPC_CHANNELS.OPEN_BROWSER, url, type)) as {
    savePath: string;
    history: string[];
  } | null;
}

/**
 * Writes the text into the clipboard as plain text.
 * @param {string} text - plain text.
 */
export async function clipboardWriteText(text: string) {
  await ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_WRITE_TEXT, text);
}
