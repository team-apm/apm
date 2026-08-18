import { Core } from 'apm-schema';
import log from 'electron-log/renderer';
import fs from 'fs-extra';
import path from 'node:path';
import ApmJson from '../../lib/ApmJson';
import * as buttonTransition from '../../lib/buttonTransition';
import { getConfig } from '../../lib/Config';
import { app, openDialog, openDirDialog } from '../../lib/ipcWrapper';
import * as modList from '../../lib/modList';
import replaceText from '../../lib/replaceText';
import { trpc } from '../../lib/trpcClient';
import migration2to3 from '../../migration/migration2to3';
import { programs } from './common';
import packageMain from './package';
import packageUtil from './packageUtil';

const config = getConfig();

// Functions to be exported

/**
 * Initializes core
 *
 */
async function initCore() {
  if (!config.hasInstallationPath()) {
    const instPath = path.join(await app.getPath('home'), 'aviutl');
    config.setInstallationPath(instPath);
  }
}

/**
 * Displays installed version.
 */
async function displayInstalledVersion() {
  // AviUtl・拡張編集行の表示は React(ProgramRow)が tRPC 経由で行う。
  // ここでは日付表示の更新と React への再描画通知のみ行う。
  if (config.modDate.hasCore()) {
    const modDate = new Date(config.modDate.getCore());
    replaceText('core-mod-date', modDate.toLocaleString());

    const checkDate = new Date(config.checkDate.getCore());
    replaceText('core-check-date', checkDate.toLocaleString());
  } else {
    replaceText('core-mod-date', '未取得');

    replaceText('core-check-date', '未確認');
  }

  window.dispatchEvent(new Event('apm-core-changed'));
}

/**
 * Returns an object parsed from core.json.
 * 実装は main プロセス側(src/main/services/core.ts)へ移設済み。
 * @returns {Promise<Core>} - An object parsed from core.json.
 */
async function getCoreInfo() {
  // tRPC の Serialize 型はプロパティを optional 化するため元の型に戻す
  return (await trpc.core.getCoreInfo.query()) as Core | null;
}

/**
 * Checks the latest versionof programs.
 */
async function checkLatestVersion() {
  const btn = document.getElementById(
    'check-core-version',
  ) as HTMLButtonElement;
  const { enableButton } = buttonTransition.loading(btn, '更新');

  try {
    // ダウンロードと日付更新は main プロセス側(services/core.ts)へ移設済み
    await trpc.core.checkLatestVersion.mutate();
    await displayInstalledVersion();
    buttonTransition.message(btn, '更新完了', 'success');
  } catch (e) {
    log.error(e);
    buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
  }

  setTimeout(() => {
    enableButton();
  }, 3000);
}

/**
 * Shows a dialog to select installation path and set it.
 * @param {HTMLInputElement} input - A HTMLElement of input.
 */
async function selectInstallationPath(input: HTMLInputElement) {
  const originalPath = input.value;
  const selectedPath = await openDirDialog(
    'インストール先フォルダを選択',
    originalPath,
  );
  if (selectedPath.length !== 0 && selectedPath[0] !== originalPath) {
    if (fs.existsSync(path.join(selectedPath[0], 'plugins/exedit.auf'))) {
      await openDialog(
        'エラー',
        '拡張編集が「plugins」フォルダに配置されています。apmは拡張編集を「aviutl.exe」と同じフォルダに配置する場合のみに対応しています。',
        'error',
      );
      return;
    }

    const instPath = selectedPath[0];
    await changeInstallationPath(instPath);
    input.value = instPath;
    // インストール先の確定を React(ProgramRow)へ通知する
    window.dispatchEvent(new Event('apm-core-changed'));
  }
}

/**
 * Change the installation path.
 * @param {string} instPath - An installation path.
 */
async function changeInstallationPath(instPath: string) {
  config.setInstallationPath(instPath);

  // update 1
  await modList.updateInfo();
  const currentMod = await modList.getInfo();

  if (fs.existsSync(instPath)) {
    // migration
    await migration2to3.byFolder(instPath);

    if (fs.existsSync(ApmJson.getPath(instPath)) && currentMod.convert) {
      const apmJson = await ApmJson.load(instPath);
      const oldConvertMod = new Date(
        (await apmJson.get('convertMod', 0)) as number,
      );
      const currentConvertMod = new Date(currentMod.convert.modified).getTime();

      if (oldConvertMod.getTime() < currentConvertMod)
        // 変換辞書の取得と apm.json の書き換えは main プロセス側
        // (services/packages.ts の convertPackageIds)へ移設済み
        await trpc.packages.convertIds.mutate({
          instPath,
          modTime: currentConvertMod,
        });
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
    await packageMain.getScriptsList(true);
  }
  if (oldCoreMod.getTime() < new Date(currentMod.core.modified).getTime()) {
    await checkLatestVersion();
  }
  if (
    oldPackagesMod.getTime() <
    Math.max(...currentMod.packages.map((p) => new Date(p.modified).getTime()))
  ) {
    await packageMain.checkPackagesList(instPath);
  }

  // redraw
  await displayInstalledVersion();
  await packageMain.setPackagesList(instPath);
}

/**
 * Installs a program to installation path.
 * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
 * @param {string} program - A program name to install.
 * @param {string} version - A version to install.
 * @param {string} instPath - An installation path.
 */
async function installProgram(
  btn: HTMLButtonElement,
  program: (typeof programs)[number],
  version: string,
  instPath: string,
) {
  const { enableButton } = btn
    ? buttonTransition.loading(btn)
    : { enableButton: null };

  // ボタンへのエラー表示と復帰(旧コードの各分岐と同じ動き)
  const showError = (message: string) => {
    if (btn) {
      buttonTransition.message(btn, message, 'danger');
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
  };

  if (!instPath) {
    log.error('An installation path is not selected.');
    showError('インストール先フォルダを指定してください。');
    return;
  }

  if (!version) {
    log.error('A version is not selected.');
    showError('バージョンを指定してください。');
    return;
  }

  // ダウンロード・整合性検証・展開・配置は main プロセス側(services/core.ts)へ移設済み
  let result: Awaited<ReturnType<typeof trpc.core.installProgram.mutate>>;
  try {
    result = await trpc.core.installProgram.mutate({
      program,
      version,
      instPath,
    });
  } catch (e) {
    log.error(e);
    showError('エラーが発生しました。');
    return;
  }

  if (result === 'noVersionData') {
    showError('バージョンデータが存在しません。');
    return;
  }

  if (result === 'downloadFailed') {
    showError('ダウンロード中にエラーが発生しました。');
    return;
  }

  if (result === 'corrupt') {
    showError('ダウンロードされたファイルは破損しています。');
    return;
  }

  if (result === 'redownloadFailed') {
    if (btn) {
      showError('ファイルのダウンロードに失敗しました。');
      return;
    } else {
      // Throw an error if not executed from the UI.
      throw new Error('Failed downloading the archive file.');
    }
  }

  try {
    if (result === 'success') {
      await displayInstalledVersion();
      await packageMain.setPackagesList(instPath);

      if (btn) buttonTransition.message(btn, 'インストール完了', 'success');
    } else {
      // installFailed: エラー内容は main プロセス側でログ済み
      if (btn)
        buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
    }
  } catch (e) {
    log.error(e);
    if (btn) buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
  }

  if (btn)
    setTimeout(() => {
      enableButton();
    }, 3000);
}

/**
 * Perform a batch installation.
 * @param {string} instPath - An installation path.
 */
async function batchInstall(instPath: string) {
  const btn = document.getElementById('batch-install') as HTMLButtonElement;
  const { enableButton } = buttonTransition.loading(
    btn,
    'AviUtl・拡張編集とおすすめプラグインのインストール',
  );

  if (!instPath) {
    log.error('An installation path is not selected.');
    if (btn) {
      buttonTransition.message(
        btn,
        'インストール先フォルダを指定してください。',
        'danger',
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
    return;
  }

  try {
    const coreInfo = await getCoreInfo();
    for (const program of programs) {
      const progInfo = coreInfo[program];
      await installProgram(null, program, progInfo.latestVersion, instPath);
    }
    const allPackages = (await packageUtil.getPackagesExtra(instPath)).packages;
    const packages = allPackages.filter(
      (p) =>
        p.info.directURL &&
        [
          packageUtil.states.notInstalled,
          packageUtil.states.installedButBroken,
        ].some((status) => status === p.installationStatus),
    );
    for (const packageItem of packages) {
      await packageMain.installPackage(instPath, packageItem, true);
    }

    buttonTransition.message(btn, 'インストール完了', 'success');
  } catch (e) {
    log.error(e);
    buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
  }

  setTimeout(() => {
    enableButton();
  }, 3000);
}

const core = {
  initCore,
  displayInstalledVersion,
  getCoreInfo,
  checkLatestVersion,
  selectInstallationPath,
  changeInstallationPath,
  installProgram,
  batchInstall,
};
export default core;
