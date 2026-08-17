import type { List } from 'apm-schema';
import type { BrowserWindow } from 'electron';
import { readJson } from 'fs-extra';
import * as os from 'node:os';
import path from 'node:path';
import type Config from '../../lib/Config';
import { resolvePath } from '../../shared/resolvePath';
import { downloadFile } from './download';
import { existsTempFile } from './tempFile';

/**
 * Downloads list.json and updates the package data file URLs in the config.
 * 旧 src/lib/modList.ts の updateInfo(+ setPackagesDataUrl)と同一の挙動。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 */
export async function updateInfo(win: BrowserWindow, config: Config) {
  await downloadFile(win, path.join(config.dataURL.getMain(), 'list.json'));

  const modFile = existsTempFile('list.json');
  const info = (await readJson(modFile.path)) as List;
  const URLs = config.dataURL
    .getExtra()
    .split(os.EOL)
    .filter((url) => url !== '');
  const packages = ([] as string[]).concat(
    info.packages.map((packageItem) =>
      resolvePath(config.dataURL.getMain(), packageItem.path),
    ),
    URLs,
  );
  config.dataURL.setPackages(packages);
}

/**
 * Returns an object parsed from list.json, downloading it if not cached.
 * 旧 src/lib/modList.ts の getInfo と同一の挙動(読めなければ null)。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @returns {Promise<List | null>} An object parsed from list.json.
 */
export async function getInfo(
  win: BrowserWindow,
  config: Config,
): Promise<List | null> {
  if (!existsTempFile('list.json').exists) {
    await updateInfo(win, config);
  }
  const modFile = existsTempFile('list.json');
  if (!modFile.exists) return null;
  try {
    return (await readJson(modFile.path)) as List;
  } catch {
    return null;
  }
}

/**
 * Returns a core data file URL.
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @returns {Promise<string>} A core data file URL.
 */
export async function getCoreDataUrl(win: BrowserWindow, config: Config) {
  const info = await getInfo(win, config);
  return resolvePath(config.dataURL.getMain(), info.core.path);
}

/**
 * Returns a convert data file URL.
 * 旧 src/lib/modList.ts の getConvertDataUrl と同一の挙動。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @returns {Promise<string>} A convert data file URL.
 */
export async function getConvertDataUrl(win: BrowserWindow, config: Config) {
  const info = await getInfo(win, config);
  return resolvePath(config.dataURL.getMain(), info.convert.path);
}

/**
 * Returns scripts data file URLs.
 * 旧 src/lib/modList.ts の getScriptsDataUrl と同一の挙動。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @returns {Promise<string[]>} Scripts data file URLs.
 */
export async function getScriptsDataUrl(win: BrowserWindow, config: Config) {
  const info = await getInfo(win, config);
  return info.scripts.map((script) =>
    resolvePath(config.dataURL.getMain(), script.path),
  );
}
