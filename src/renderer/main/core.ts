import { Core, Program } from 'apm-schema';
import log from 'electron-log/renderer';
import fs from 'fs-extra';
import path from 'node:path';
import ApmJson from '../../lib/ApmJson';
import * as buttonTransition from '../../lib/buttonTransition';
import { getConfig } from '../../lib/Config';
import { convertId } from '../../lib/convertId';
import { app, openDialog, openDirDialog } from '../../lib/ipcWrapper';
import * as modList from '../../lib/modList';
import replaceText from '../../lib/replaceText';
import { addAviUtlShortcut, removeAviUtlShortcut } from '../../lib/shortcut';
import { trpc } from '../../lib/trpcClient';
import migration2to3 from '../../migration/migration2to3';
import {
  installedVersionText,
  releaseLabel,
} from '../../shared/coreVersionText';
import { checkIntegrity } from '../../shared/integrity';
import { programs, verifyFilesByCount } from './common';
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
 * @param {string} instPath - An installation path.
 */
async function displayInstalledVersion(instPath: string) {
  const coreInfo = await getCoreInfo();
  const isInstalled = { aviutl: false, exedit: false };
  if (instPath && coreInfo) {
    for (const program of programs) {
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
      replaceText(
        `${program}-installed-version`,
        installedVersionText(
          installedVersion,
          progInfo.latestVersion,
          filesVerified,
        ),
      );
      if (filesVerified) isInstalled[program] = true;
    }
  } else {
    for (const program of programs) {
      replaceText(`${program}-installed-version`, '未取得');
    }
  }

  if (config.modDate.hasCore()) {
    const modDate = new Date(config.modDate.getCore());
    replaceText('core-mod-date', modDate.toLocaleString());

    const checkDate = new Date(config.checkDate.getCore());
    replaceText('core-check-date', checkDate.toLocaleString());
  } else {
    replaceText('core-mod-date', '未取得');

    replaceText('core-check-date', '未確認');
  }

  // Add a shortcut to the Start menu
  if (process.platform === 'win32') {
    const appDataPath = await app.getPath('appData');
    const apmPath = await app.getPath('exe');
    const aviutlPath = path.join(instPath, 'aviutl.exe');
    if (
      fs.existsSync(aviutlPath) &&
      apmPath.includes(path.dirname(appDataPath)) // Verify that it is the installed version of apm
    ) {
      addAviUtlShortcut(appDataPath, aviutlPath);
    } else {
      removeAviUtlShortcut(appDataPath);
    }
  }
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
 * Sets versions of each program in selects.
 * @param {string} instPath - An installation path.
 */
async function setCoreVersions(instPath: string) {
  const aviutlVersionSelect = document.getElementById('aviutl-version-select');
  const exeditVersionSelect = document.getElementById('exedit-version-select');
  while (aviutlVersionSelect.childElementCount > 0) {
    aviutlVersionSelect.removeChild(aviutlVersionSelect.lastChild);
  }
  while (exeditVersionSelect.childElementCount > 0) {
    exeditVersionSelect.removeChild(exeditVersionSelect.lastChild);
  }

  const coreInfo = await getCoreInfo();
  if (!coreInfo) {
    for (const program of programs) {
      replaceText(`${program}-latest-version`, '未取得');
    }
    return;
  }

  const installAviutlBtn = document.getElementById(
    'install-aviutl',
  ) as HTMLButtonElement;
  const installExeditBtn = document.getElementById(
    'install-exedit',
  ) as HTMLButtonElement;

  for (const program of programs) {
    for (const release of coreInfo[program].releases) {
      const li = document.createElement('li');
      const anchor = document.createElement('a');
      anchor.classList.add('dropdown-item');
      anchor.href = '#';
      anchor.innerText = releaseLabel(
        release.version,
        coreInfo[program].latestVersion,
      );
      li.appendChild(anchor);

      if (program === 'aviutl') {
        anchor.addEventListener('click', async () => {
          await installProgram(
            installAviutlBtn,
            program,
            release.version,
            instPath,
          );
        });
        aviutlVersionSelect.appendChild(li);
      } else if (program === 'exedit') {
        anchor.addEventListener('click', async () => {
          await installProgram(
            installExeditBtn,
            program,
            release.version,
            instPath,
          );
        });
        exeditVersionSelect.appendChild(li);
      }
    }
  }
}

/**
 * Checks the latest versionof programs.
 * @param {string} instPath - An installation path.
 */
async function checkLatestVersion(instPath: string) {
  const btn = document.getElementById(
    'check-core-version',
  ) as HTMLButtonElement;
  const { enableButton } = buttonTransition.loading(btn, '更新');

  try {
    // ダウンロードと日付更新は main プロセス側(services/core.ts)へ移設済み
    await trpc.core.checkLatestVersion.mutate();
    await displayInstalledVersion(instPath);
    await setCoreVersions(instPath);
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
        await convertId(instPath, currentConvertMod);
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
    await checkLatestVersion(instPath);
  }
  if (
    oldPackagesMod.getTime() <
    Math.max(...currentMod.packages.map((p) => new Date(p.modified).getTime()))
  ) {
    await packageMain.checkPackagesList(instPath);
  }

  // redraw
  await displayInstalledVersion(instPath);
  await setCoreVersions(instPath);
  await packageMain.setPackagesList(instPath);
  await packageMain.displayNicommonsIdList(instPath);
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
      await displayInstalledVersion(instPath);
      await packageMain.setPackagesList(instPath);
      await packageMain.displayNicommonsIdList(instPath);

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
    const allPackages = (
      await packageUtil.getPackagesExtra(
        await packageMain.getPackages(instPath),
        instPath,
      )
    ).packages;
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
  setCoreVersions,
  checkLatestVersion,
  selectInstallationPath,
  changeInstallationPath,
  installProgram,
  batchInstall,
};
export default core;
