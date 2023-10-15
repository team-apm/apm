import { Core, Program } from 'apm-schema';
import log from 'electron-log';
import Store from 'electron-store';
import fs from 'fs-extra';
import path from 'path';
import * as apmJson from '../../lib/apmJson';
import * as buttonTransition from '../../lib/buttonTransition';
import compareVersion from '../../lib/compareVersion';
import { convertId } from '../../lib/convertId';
import { checkIntegrity, verifyFile } from '../../lib/integrity';
import {
  app,
  download,
  existsTempFile,
  openDialog,
  openDirDialog,
  openYesNoDialog,
} from '../../lib/ipcWrapper';
import * as modList from '../../lib/modList';
import * as parseJson from '../../lib/parseJson';
import replaceText from '../../lib/replaceText';
import { addAviUtlShortcut, removeAviUtlShortcut } from '../../lib/shortcut';
import unzip from '../../lib/unzip';
import migration2to3 from '../../migration/migration2to3';
import { install, programs, programsDisp, verifyFilesByCount } from './common';
import packageMain from './package';
import packageUtil from './packageUtil';
const store = new Store();

// Functions to be exported

/**
 * Initializes core
 *
 */
async function initCore() {
  if (!store.has('installationPath')) {
    const instPath = path.join(await app.getPath('home'), 'aviutl');
    store.set('installationPath', instPath);
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
      if (!(await apmJson.has(instPath, 'core.' + program))) {
        for (const release of progInfo.releases) {
          if (await checkIntegrity(instPath, release.integrity.file))
            await apmJson.setCore(instPath, program, release.version);
        }
      }

      if (await apmJson.has(instPath, 'core.' + program)) {
        const installedVersion = (await apmJson.get(
          instPath,
          'core.' + program,
        )) as string;
        const description =
          compareVersion(installedVersion, progInfo.latestVersion) === -1
            ? ` （最新版: ${progInfo.latestVersion}）`
            : installedVersion.includes('rc')
            ? '（テスト版）'
            : ' （最新版）';
        if (verifyFilesByCount(instPath, progInfo.files)) {
          replaceText(
            `${program}-installed-version`,
            'バージョン: ' + installedVersion + description,
          );
          isInstalled[program] = true;
        } else {
          replaceText(
            `${program}-installed-version`,
            'バージョン: ' +
              installedVersion +
              description +
              '（ファイルの存在が確認できませんでした。）',
          );
        }
      } else {
        if (verifyFilesByCount(instPath, progInfo.files)) {
          replaceText(`${program}-installed-version`, '手動インストール済み');
          isInstalled[program] = true;
        } else {
          replaceText(`${program}-installed-version`, '未インストール');
        }
      }
    }
  } else {
    for (const program of programs) {
      replaceText(`${program}-installed-version`, '未取得');
    }
  }

  if (store.has('modDate.core')) {
    const modDate = new Date(store.get('modDate.core') as number);
    replaceText('core-mod-date', modDate.toLocaleString());

    const checkDate = new Date(store.get('checkDate.core') as number);
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
 * @returns {Promise<Core>} - An object parsed from core.json.
 */
async function getCoreInfo() {
  const coreFile = await existsTempFile(
    path.join('core', path.basename(await modList.getCoreDataUrl())),
  );
  if (!coreFile.exists) return null;

  try {
    return await parseJson.getCore(coreFile.path);
  } catch (e) {
    log.error(e);
    return null;
  }
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
      anchor.innerText =
        release.version +
        (release.version.includes('rc') ? '（テスト版）' : '') +
        (release.version === coreInfo[program].latestVersion
          ? '（最新版）'
          : '');
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
    await download(await modList.getCoreDataUrl(), {
      subDir: 'core',
    });
    await modList.updateInfo();
    store.set('checkDate.core', Date.now());
    const modInfo = await modList.getInfo();
    store.set('modDate.core', new Date(modInfo.core.modified).getTime());
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
 * @param {HTMLInputElement} installationPath - A HTMLElement of input.
 */
async function selectInstallationPath(installationPath: HTMLSpanElement) {
  const originalPath = installationPath.innerText;
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
    installationPath.innerText = instPath;
  }
}

/**
 * Change the installation path.
 * @param {string} instPath - An installation path.
 */
async function changeInstallationPath(instPath: string) {
  store.set('installationPath', instPath);

  // update 1
  await modList.updateInfo();
  const currentMod = await modList.getInfo();

  if (fs.existsSync(instPath)) {
    // migration
    await migration2to3.byFolder(instPath);

    if (fs.existsSync(apmJson.getPath(instPath)) && currentMod.convert) {
      const oldConvertMod = new Date(
        (await apmJson.get(instPath, 'convertMod', 0)) as number,
      );
      const currentConvertMod = new Date(currentMod.convert.modified).getTime();

      if (oldConvertMod.getTime() < currentConvertMod)
        await convertId(instPath, currentConvertMod);
    }
  }

  // update 2
  const oldScriptsMod = new Date(store.get('modDate.scripts', 0) as number);
  const oldCoreMod = new Date(store.get('modDate.core', 0) as number);
  const oldPackagesMod = new Date(store.get('modDate.packages', 0) as number);

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

  if (!version) {
    log.error('A version is not selected.');
    if (btn) {
      buttonTransition.message(btn, 'バージョンを指定してください。', 'danger');
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
    return;
  }

  const coreInfo = await getCoreInfo();

  if (!coreInfo) {
    log.error('The version data do not exist.');
    if (btn) {
      buttonTransition.message(
        btn,
        'バージョンデータが存在しません。',
        'danger',
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
    return;
  }

  const progInfo = coreInfo[program] as Program;
  const url = progInfo.releases.find((r) => r.version === version).url;
  let archivePath = await download(url, { loadCache: true, subDir: 'core' });

  if (!archivePath) {
    log.error('Failed downloading a file.');
    if (btn) {
      buttonTransition.message(
        btn,
        'ダウンロード中にエラーが発生しました。',
        'danger',
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
    return;
  }

  const integrityForArchive = progInfo.releases.find(
    (r) => r.version === version,
  ).integrity.archive;

  if (integrityForArchive) {
    // Verify file integrity
    while (!(await verifyFile(archivePath, integrityForArchive))) {
      const dialogResult = await openYesNoDialog(
        'エラー',
        'ダウンロードされたファイルは破損しています。再ダウンロードしますか？',
      );

      if (!dialogResult) {
        log.error(`The downloaded archive file is corrupt. URL:${url}`);
        if (btn) {
          buttonTransition.message(
            btn,
            'ダウンロードされたファイルは破損しています。',
            'danger',
          );
          setTimeout(() => {
            enableButton();
          }, 3000);
        }
        return;
      }

      archivePath = await download(url, { subDir: 'core' });
      if (!archivePath) {
        log.error(`Failed downloading the archive file. URL:${url}`);
        if (btn) {
          buttonTransition.message(
            btn,
            'ファイルのダウンロードに失敗しました。',
            'danger',
          );
          setTimeout(() => {
            enableButton();
          }, 3000);
          return;
        } else {
          // Throw an error if not executed from the UI.
          throw new Error('Failed downloading the archive file.');
        }
      }
    }
  }

  try {
    const unzippedPath = await unzip(archivePath);
    await install(unzippedPath, instPath, progInfo.files, true);

    await apmJson.setCore(instPath, program, version);
    await displayInstalledVersion(instPath);
    await packageMain.setPackagesList(instPath);
    await packageMain.displayNicommonsIdList(instPath);

    if (btn) buttonTransition.message(btn, 'インストール完了', 'success');
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
    '最新版のAviUtl・拡張編集とおすすめプラグインをインストール',
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
        p.installationStatus === packageUtil.states.notInstalled,
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
