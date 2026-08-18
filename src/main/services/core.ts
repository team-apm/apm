import type { Core, Program } from 'apm-schema';
import { app, type BrowserWindow, dialog } from 'electron';
import log from 'electron-log/main';
import { existsSync, readJson } from 'fs-extra';
import path from 'node:path';
import type Config from '../../lib/Config';
import { installedVersionText } from '../../shared/coreVersionText';
import { install, verifyFilesByCount } from '../../shared/install';
import { checkIntegrity, verifyFile } from '../../shared/integrity';
import unzip from '../../shared/unzip';
import ApmJson from '../ApmJson';
import { addAviUtlShortcut, removeAviUtlShortcut } from '../shortcut';
import { downloadFile } from './download';
import { migrationByFolder } from './migration';
import { getCoreDataUrl, getInfo, updateInfo } from './modList';
import { convertPackageIds } from './packages';
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

/**
 * Downloads the core data file and updates the check/mod dates in the config.
 * 旧 src/renderer/main/core.ts の checkLatestVersion の計算部分と同一の挙動
 * (失敗はそのまま throw し、メッセージへの丸め込みは renderer 側の責務)。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 */
export async function checkCoreLatestVersion(
  win: BrowserWindow,
  config: Config,
) {
  await downloadFile(win, await getCoreDataUrl(win, config), {
    subDir: 'core',
  });
  await updateInfo(win, config);
  config.checkDate.setCore(Date.now());
  const modInfo = await getInfo(win, config);
  config.modDate.setCore(new Date(modInfo.core.modified).getTime());
}

/**
 * Returns the core versions recorded in apm.json.
 * 共有文字列の互換性チェック(React 側)が参照する。未記録なら undefined。
 * @param {string} instPath - An installation path.
 * @returns {Promise<{ aviutl?: string; exedit?: string }>} The recorded versions.
 */
export async function getApmJsonCoreVersions(
  instPath: string,
): Promise<{ aviutl?: string; exedit?: string }> {
  const apmJson = await ApmJson.load(instPath);
  return {
    aviutl: (await apmJson.get('core.aviutl')) as string | undefined,
    exedit: (await apmJson.get('core.exedit')) as string | undefined,
  };
}

/**
 * Returns the installed-version texts of AviUtl and 拡張編集.
 * 旧 src/renderer/main/core.ts の displayInstalledVersion の計算部分と同一の挙動。
 * 表示テキストの算出に加えて、整合性検証による apm.json の補正書き込みと
 * Start メニューショートカットの更新(win32 のみ)という副作用を持つ。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @returns {Promise<{ aviutl: string; exedit: string }>} The texts to display.
 */
export async function getInstalledVersionTexts(
  win: BrowserWindow,
  config: Config,
  instPath: string,
): Promise<{ aviutl: string; exedit: string }> {
  const coreInfo = await getCoreInfo(win, config);
  const texts = { aviutl: '未取得', exedit: '未取得' };
  if (instPath && coreInfo) {
    for (const program of ['aviutl', 'exedit'] as const) {
      const progInfo: Program = coreInfo[program];

      // Set the version of the manually installed program
      const apmJson = await ApmJson.load(instPath);
      if (!(await apmJson.has('core.' + program))) {
        for (const release of progInfo.releases) {
          if (await checkIntegrity(instPath, release.integrity.file))
            await apmJson.setCore(program, release.version);
        }
      }

      const installedVersion = (await apmJson.has('core.' + program))
        ? ((await apmJson.get('core.' + program)) as string)
        : null;
      const filesVerified = verifyFilesByCount(instPath, progInfo.files);
      texts[program] = installedVersionText(
        installedVersion,
        progInfo.latestVersion,
        filesVerified,
      );
    }
  }

  // Add a shortcut to the Start menu
  if (process.platform === 'win32') {
    const appDataPath = app.getPath('appData');
    const apmPath = app.getPath('exe');
    const aviutlPath = path.join(instPath, 'aviutl.exe');
    if (
      existsSync(aviutlPath) &&
      apmPath.includes(path.dirname(appDataPath)) // Verify that it is the installed version of apm
    ) {
      addAviUtlShortcut(appDataPath, aviutlPath);
    } else {
      removeAviUtlShortcut(appDataPath);
    }
  }

  return texts;
}

export type InstallCoreResult =
  | 'success'
  | 'noVersionData'
  | 'downloadFailed'
  | 'corrupt'
  | 'redownloadFailed'
  | 'installFailed';

/**
 * Downloads, verifies, unzips and installs a core program, then records the
 * version in apm.json.
 * 旧 src/renderer/main/core.ts の installProgram の計算部分と同一の挙動。
 * ボタン表示は renderer の責務なので、分岐結果をステータスで返す。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {'aviutl' | 'exedit'} program - A program name to install.
 * @param {string} version - A version to install.
 * @param {string} instPath - An installation path.
 * @returns {Promise<InstallCoreResult>} The result of the installation.
 */
export async function installCoreProgram(
  win: BrowserWindow,
  config: Config,
  program: 'aviutl' | 'exedit',
  version: string,
  instPath: string,
): Promise<InstallCoreResult> {
  const coreInfo = await getCoreInfo(win, config);
  if (!coreInfo) {
    log.error('The version data do not exist.');
    return 'noVersionData';
  }

  const progInfo = coreInfo[program] as Program;
  const release = progInfo.releases.find((r) => r.version === version);
  const url = release.url;
  let archivePath = await downloadFile(win, url, {
    loadCache: true,
    subDir: 'core',
  });

  if (!archivePath) {
    log.error('Failed downloading a file.');
    return 'downloadFailed';
  }

  const integrityForArchive = release.integrity.archive;

  if (integrityForArchive) {
    // Verify file integrity
    while (!(await verifyFile(archivePath, integrityForArchive))) {
      const dialogResult = await dialog.showMessageBox(win, {
        title: 'エラー',
        message:
          'ダウンロードされたファイルは破損しています。再ダウンロードしますか？',
        type: 'warning',
        buttons: ['はい', 'いいえ'],
        cancelId: 1,
      });

      if (dialogResult.response !== 0) {
        log.error(`The downloaded archive file is corrupt. URL:${url}`);
        return 'corrupt';
      }

      archivePath = await downloadFile(win, url, { subDir: 'core' });
      if (!archivePath) {
        log.error(`Failed downloading the archive file. URL:${url}`);
        return 'redownloadFailed';
      }
    }
  }

  try {
    const unzippedPath = await unzip(archivePath);
    await install(unzippedPath, instPath, progInfo.files, true);

    const apmJson = await ApmJson.load(instPath);
    await apmJson.setCore(program, version);
    return 'success';
  } catch (e) {
    log.error(e);
    return 'installFailed';
  }
}

/**
 * Returns whether ExEdit is misplaced in the `plugins` folder.
 * @param {string} instPath - An installation path.
 * @returns {boolean} True if `plugins/exedit.auf` exists.
 */
export function hasExeditInPluginsFolder(instPath: string): boolean {
  return existsSync(path.join(instPath, 'plugins/exedit.auf'));
}

export type ChangeInstallationPathResult = {
  needScriptsUpdate: boolean;
  needCoreUpdate: boolean;
  needPackagesUpdate: boolean;
};

/**
 * Applies an installation path change: updates the mod info, runs the folder
 * migration and the id conversion, and reports which data needs re-fetching.
 * 旧 src/renderer/main/core.ts の changeInstallationPath の判定・更新部分と
 * 同一の挙動。UI の再取得・再描画は renderer 側が戻り値を見て行う。
 * @param {BrowserWindow} win - The main window.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @returns {Promise<ChangeInstallationPathResult>} Which data needs re-fetching.
 */
export async function changeInstallationPath(
  win: BrowserWindow,
  config: Config,
  instPath: string,
): Promise<ChangeInstallationPathResult> {
  config.setInstallationPath(instPath);

  // update 1
  await updateInfo(win, config);
  const currentMod = await getInfo(win, config);

  if (existsSync(instPath)) {
    // migration
    await migrationByFolder(win, config, instPath);

    if (existsSync(ApmJson.getPath(instPath)) && currentMod.convert) {
      const apmJson = await ApmJson.load(instPath);
      const oldConvertMod = new Date(
        (await apmJson.get('convertMod', 0)) as number,
      );
      const currentConvertMod = new Date(currentMod.convert.modified).getTime();

      if (oldConvertMod.getTime() < currentConvertMod)
        await convertPackageIds(win, config, instPath, currentConvertMod);
    }
  }

  // update 2
  const oldScriptsMod = new Date(config.modDate.getScripts());
  const oldCoreMod = new Date(config.modDate.getCore());
  const oldPackagesMod = new Date(config.modDate.getPackages());

  return {
    needScriptsUpdate:
      oldScriptsMod.getTime() <
      Math.max(
        ...currentMod.scripts.map((p) => new Date(p.modified).getTime()),
      ),
    needCoreUpdate:
      oldCoreMod.getTime() < new Date(currentMod.core.modified).getTime(),
    needPackagesUpdate:
      oldPackagesMod.getTime() <
      Math.max(
        ...currentMod.packages.map((p) => new Date(p.modified).getTime()),
      ),
  };
}
