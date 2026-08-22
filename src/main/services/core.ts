import type { Core, Program } from 'apm-schema';
import { app } from 'electron';
import log from 'electron-log/main';
import { existsSync, readJson } from 'fs-extra';
import path from 'node:path';
import { installedVersionText } from '../../shared/coreVersionText';
import { install, verifyFilesByCount } from '../../shared/install';
import { checkIntegrity } from '../../shared/integrity';
import unzip from '../../shared/unzip';
import type Config from '../Config';
import type { Installation } from '../installation';
import Ledger from '../Ledger';
import { addAviUtlShortcut, removeAviUtlShortcut } from '../shortcut';
import { downloadFile } from './download';
import { runInstallFlow } from './installFlow';
import { migrationByFolder } from './migration';
import { getCoreDataUrl, getInfo, updateInfo } from './modList';
import { convertPackageIds, refreshPackagesList } from './packageList';
import { getScriptsList } from './scriptInstall';
import type { ServiceContext } from './serviceContext';
import { existsTempFile } from './tempFile';

/**
 * Returns an object parsed from core.json.
 * 旧 src/renderer/main/core.ts の getCoreInfo と同一の挙動
 * (未取得なら null、パース失敗はログして null)。
 * @param {ServiceContext} ctx - The service context.
 * @returns {Promise<Core | null>} An object parsed from core.json.
 */
export async function getCoreInfo(ctx: ServiceContext): Promise<Core | null> {
  const { win, config } = ctx;
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
 * @param {ServiceContext} ctx - The service context.
 */
export async function checkCoreLatestVersion(ctx: ServiceContext) {
  const { win, config } = ctx;
  await downloadFile(win, await getCoreDataUrl(win, config), {
    subDir: 'core',
  });
  await updateInfo(win, config);
  config.checkDate.setCore(Date.now());
  const modInfo = await getInfo(win, config);
  config.modDate.setCore(new Date(modInfo.core.modified).getTime());
}

/**
 * Returns the core versions recorded in the ledger.
 * 共有文字列の互換性チェック(React 側)が参照する。未記録なら undefined。
 * @param {Installation} inst - The target installation.
 * @returns {Promise<{ aviutl?: string; exedit?: string }>} The recorded versions.
 */
export async function getLedgerCoreVersions(
  inst: Installation,
): Promise<{ aviutl?: string; exedit?: string }> {
  const ledger = await inst.ledger();
  return {
    aviutl: (await ledger.get('core.aviutl')) as string | undefined,
    exedit: (await ledger.get('core.exedit')) as string | undefined,
  };
}

/**
 * Returns the installed-version texts of AviUtl and 拡張編集.
 * 旧 src/renderer/main/core.ts の displayInstalledVersion の計算部分と同一の挙動。
 * 表示テキストの算出に加えて、整合性検証による導入記録の補正書き込みと
 * Start メニューショートカットの更新(win32 のみ)という副作用を持つ。
 * @param {ServiceContext} ctx - The service context.
 * @param {Installation} inst - The target installation.
 * @returns {Promise<{ aviutl: string; exedit: string }>} The texts to display.
 */
export async function getInstalledVersionTexts(
  ctx: ServiceContext,
  inst: Installation,
): Promise<{ aviutl: string; exedit: string }> {
  const coreInfo = await getCoreInfo(ctx);
  const texts = { aviutl: '未取得', exedit: '未取得' };
  if (inst.path && coreInfo) {
    for (const program of ['aviutl', 'exedit'] as const) {
      const progInfo: Program = coreInfo[program];

      // Set the version of the manually installed program
      const ledger = await inst.ledger();
      if (!(await ledger.has('core.' + program))) {
        for (const release of progInfo.releases) {
          if (await checkIntegrity(inst.path, release.integrity.file))
            await ledger.setCore(program, release.version);
        }
      }

      const installedVersion = (await ledger.has('core.' + program))
        ? ((await ledger.get('core.' + program)) as string)
        : null;
      const filesVerified = verifyFilesByCount(inst.path, progInfo.files);
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
    const aviutlPath = path.join(inst.path, 'aviutl.exe');
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
 * version in the ledger.
 * 旧 src/renderer/main/core.ts の installProgram の計算部分と同一の挙動。
 * ボタン表示は renderer の責務なので、分岐結果をステータスで返す。
 * @param {ServiceContext} ctx - The service context.
 * @param {Installation} inst - The target installation.
 * @param {'aviutl' | 'exedit'} program - A program name to install.
 * @param {string} version - A version to install.
 * @returns {Promise<InstallCoreResult>} The result of the installation.
 */
export async function installCoreProgram(
  ctx: ServiceContext,
  inst: Installation,
  program: 'aviutl' | 'exedit',
  version: string,
): Promise<InstallCoreResult> {
  const { win } = ctx;
  const coreInfo = await getCoreInfo(ctx);
  if (!coreInfo) {
    log.error('The version data do not exist.');
    return 'noVersionData';
  }

  const progInfo = coreInfo[program] as Program;
  const release = progInfo.releases.find((r) => r.version === version);
  const url = release.url;

  return await runInstallFlow<'downloadFailed' | 'redownloadFailed'>(win, {
    resolveArchive: async () => {
      const archivePath = await downloadFile(win, url, {
        loadCache: true,
        subDir: 'core',
      });
      if (!archivePath) {
        log.error('Failed downloading a file.');
        return { failure: 'downloadFailed' as const };
      }
      return { archivePath };
    },
    integrity: release.integrity.archive,
    corruptLogUrl: url,
    redownloadArchive: async () => {
      const archivePath = await downloadFile(win, url, { subDir: 'core' });
      if (!archivePath) {
        log.error(`Failed downloading the archive file. URL:${url}`);
        return { failure: 'redownloadFailed' as const };
      }
      return { archivePath };
    },
    install: async (archivePath) => {
      const unzippedPath = await unzip(archivePath);
      // install() の戻り値を検証しないのは旧実装のままの挙動
      // (core は配置数の検証をせず、throw しなければ成功とみなす)
      await install(unzippedPath, inst.path, progInfo.files, true);

      const ledger = await inst.ledger();
      await ledger.setCore(program, version);
      return true;
    },
  });
}

/**
 * Returns whether ExEdit is misplaced in the `plugins` folder.
 * @param {Installation} inst - The target installation.
 * @returns {boolean} True if `plugins/exedit.auf` exists.
 */
export function hasExeditInPluginsFolder(inst: Installation): boolean {
  return existsSync(path.join(inst.path, 'plugins/exedit.auf'));
}

/**
 * Applies an installation path change: updates the mod info, runs the folder
 * migration and the id conversion, and re-fetches the outdated data.
 * 旧 src/renderer/main/core.ts の changeInstallationPath と同一の挙動
 * (判定に加えて scripts・core・packages の再取得まで行う)。
 * UI の再描画は renderer 側の責務。
 * @param {ServiceContext} ctx - The service context.
 * @param {Installation} inst - The target installation.
 */
export async function changeInstallationPath(
  ctx: ServiceContext,
  inst: Installation,
): Promise<void> {
  const { win, config } = ctx;
  config.setInstallationPath(inst.path);

  // update 1
  await updateInfo(win, config);
  const currentMod = await getInfo(win, config);

  if (existsSync(inst.path)) {
    // migration
    await migrationByFolder(ctx, inst);

    if (existsSync(Ledger.getPath(inst.path)) && currentMod.convert) {
      const ledger = await inst.ledger();
      const oldConvertMod = new Date(
        (await ledger.get('convertMod', 0)) as number,
      );
      const currentConvertMod = new Date(currentMod.convert.modified).getTime();

      if (oldConvertMod.getTime() < currentConvertMod)
        await convertPackageIds(ctx, inst, currentConvertMod);
    }
  }

  // update 2
  const oldScriptsMod = new Date(config.modDate.getScripts());
  const oldCoreMod = new Date(config.modDate.getCore());
  const oldPackagesMod = new Date(config.modDate.getPackages());

  if (
    oldScriptsMod.getTime() <
    Math.max(...currentMod.scripts.map((p) => new Date(p.modified).getTime()))
  ) {
    await getScriptsList(ctx, true);
  }
  if (oldCoreMod.getTime() < new Date(currentMod.core.modified).getTime()) {
    // 旧 renderer の checkLatestVersion は失敗をボタン表示に丸めて
    // 後続処理を続けていたため、ここでも throw せずログのみ残す
    try {
      await checkCoreLatestVersion(ctx);
    } catch (e) {
      log.error(e);
    }
  }
  if (
    oldPackagesMod.getTime() <
    Math.max(...currentMod.packages.map((p) => new Date(p.modified).getTime()))
  ) {
    // 旧 renderer の checkPackagesList も同様に失敗を throw しない
    try {
      await refreshPackagesList(ctx, inst);
    } catch (e) {
      log.error(e);
    }
  }
}

/**
 * Ensures that an installation path is set, and returns it.
 * 旧 src/renderer/main/core.ts の initCore(未設定なら home/aviutl を
 * 既定値として書き込む)+ config.getInstallationPath() と同一の挙動。
 * @param {Config} config - The config instance.
 * @returns {string} The installation path.
 */
export function ensureInstallationPath(config: Config): string {
  if (!config.hasInstallationPath()) {
    config.setInstallationPath(path.join(app.getPath('home'), 'aviutl'));
  }
  return config.getInstallationPath();
}

/**
 * Returns the mod/check dates of the core programs, or null if not fetched.
 * 旧 src/renderer/main/core.ts の displayInstalledVersion が読んでいた
 * config 値と同一(modDate が無ければ null)。
 * @param {Config} config - The config instance.
 * @returns {{ modDate: number; checkDate: number } | null} The dates.
 */
export function getCoreDates(
  config: Config,
): { modDate: number; checkDate: number } | null {
  if (!config.modDate.hasCore()) return null;
  return {
    modDate: config.modDate.getCore(),
    checkDate: config.checkDate.getCore(),
  };
}
