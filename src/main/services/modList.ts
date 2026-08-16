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
