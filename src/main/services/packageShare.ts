import type { Packages } from 'apm-schema';
import { app, type BrowserWindow } from 'electron';
import { existsSync, readJson, writeJson } from 'fs-extra';
import path from 'node:path';
import { convertV1PackageIds } from '../../shared/packageId';
import { states } from '../../shared/packageUtil';
import { programs } from '../../shared/programs';
import { shareStringVersion } from '../../shared/shareString';
import ApmJson from '../ApmJson';
import type Config from '../Config';
import { getIdDict, getPackagesExtra } from './packageList';

/**
 * Builds the share string of the installed packages for the clipboard.
 * 旧 src/renderer/main/package.ts の sharePackages の文字列生成部分と同一の
 * 挙動(クリップボードへの書き込みとボタン表示は renderer 側の責務)。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @returns {Promise<string>} The share string.
 */
export async function buildShareString(
  win: BrowserWindow,
  config: Config,
  instPath: string,
) {
  const ver = {
    share: shareStringVersion, // version of this data
    apm: app.getVersion(),
    aviutl: '',
    exedit: '',
    packages: [''],
  };

  const apmJson = await ApmJson.load(instPath);

  for (const program of programs) {
    const currentVersion = (await apmJson.get('core.' + program)) as string;
    ver[program] = currentVersion;
  }
  ver.packages = (await getPackagesExtra(win, config, instPath)).packages
    .filter(
      (p) =>
        p.installationStatus === states.installed ||
        p.installationStatus === states.manuallyInstalled,
    )
    .map((p) => p.id)
    .filter((id) => id.includes('/'))
    .sort((a, b) => {
      const compare = (a: string, b: string) => (a > b ? 1 : a < b ? -1 : 0);
      const a2 = a.split('/');
      const b2 = b.split('/');
      return a2[0] === b2[0] ? compare(a2[1], b2[1]) : compare(a2[0], b2[0]);
    });

  //  Variation Selectors: 🍎️(color), 🎞︎(text), 🎬︎(text)
  return `ここにタイトルを入力🍎️${ver.share}:${ver.apm},🎞︎${ver.aviutl},🎬︎${
    ver.exedit
  },${ver.packages.join(',')}`;
}

/**
 * Returns the packages of the data editor (editorPackages.json).
 * 旧 src/lib/parseJson.ts の getPackages に src/lib/modList.ts の
 * getEditorPackagesDataUrl を合成したものと同一の挙動
 * (ファイルが無いときに例外を投げる点も含めて維持)。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @returns {Promise<Packages['packages']>} A list of packages.
 */
export async function getEditorPackages(
  win: BrowserWindow,
  config: Config,
  instPath: string,
): Promise<Packages['packages']> {
  const packagesListPath = path.join(instPath, 'editorPackages.json');
  if (!existsSync(packagesListPath))
    throw new Error('The version file does not exist.');

  const packages = ((await readJson(packagesListPath)) as Packages).packages;
  convertV1PackageIds(packages, await getIdDict(win, config));
  return packages;
}

/**
 * Writes the packages of the data editor (editorPackages.json).
 * 旧 src/lib/parseJson.ts の setPackages と同一の挙動。
 * @param {string} instPath - An installation path.
 * @param {Packages['packages']} packages - A list of packages.
 */
export async function setEditorPackages(
  instPath: string,
  packages: Packages['packages'],
) {
  await writeJson(path.join(instPath, 'editorPackages.json'), {
    version: 3,
    packages: packages,
  });
}
