import type { Core } from 'apm-schema';
import type { BrowserWindow } from 'electron';
import log from 'electron-log/main';
import { readJson } from 'fs-extra';
import path from 'node:path';
import type Config from '../../lib/Config';
import { getCoreDataUrl } from './modList';
import { existsTempFile } from './tempFile';

/**
 * Returns an object parsed from core.json.
 * 旧 src/renderer/main/core.ts の getCoreInfo と同一の挙動
 * (未取得なら null、パース失敗はログして null)。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @returns {Promise<Core | null>} An object parsed from core.json.
 */
export async function getCoreInfo(
  win: BrowserWindow,
  config: Config,
): Promise<Core | null> {
  const coreFile = existsTempFile(
    path.join('core', path.basename(await getCoreDataUrl(win, config))),
  );
  if (!coreFile.exists) return null;

  try {
    return (await readJson(coreFile.path)) as Core;
  } catch (e) {
    log.error(e);
    return null;
  }
}
