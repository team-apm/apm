import log from 'electron-log';
import Store from 'electron-store';
import fs, { copySync } from 'fs-extra';
import path from 'path';
import apmJson from '../../lib/apmJson';
import buttonTransition from '../../lib/buttonTransition';
import { convertId } from '../../lib/convertId';
import integrity from '../../lib/integrity';
import {
  app,
  download,
  existsTempFile,
  openDirDialog,
  openYesNoDialog,
} from '../../lib/ipcWrapper';
import modList from '../../lib/modList';
import parseJson from '../../lib/parseJson';
import replaceText from '../../lib/replaceText';
import shortcut from '../../lib/shortcut';
import unzip from '../../lib/unzip';
import migration2to3 from '../../migration/migration2to3';
import packageMain from './package';
import packageUtil from './packageUtil';
const store = new Store();
/** @typedef {import("apm-schema").Core} Core */
/** @typedef {import("apm-schema").Program} Program */

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
 *
 * @param {string} instPath - An installation path.
 */
async function displayInstalledVersion(instPath) {
  const coreInfo = await getCoreInfo();
  if (instPath && coreInfo) {
    for (const program of ['aviutl', 'exedit']) {
      /** @type {Program} */
      const progInfo = coreInfo[program];

      // Set the version of the manually installed program
      if (!apmJson.has(instPath, 'core.' + program)) {
        for (const release of progInfo.releases) {
          if (await integrity.checkIntegrity(instPath, release.integrity.file))
            apmJson.setCore(instPath, program, release.version);
        }
      }

      let filesCount = 0;
      let existCount = 0;
      for (const file of progInfo.files) {
        if (!file.isUninstallOnly) {
          filesCount++;
          if (fs.existsSync(path.join(instPath, file.filename))) {
            existCount++;
          }
        }
      }

      if (apmJson.has(instPath, 'core.' + program)) {
        if (filesCount === existCount) {
          replaceText(
            `${program}-installed-version`,
            apmJson.get(instPath, 'core.' + program, '未インストール')
          );
        } else {
          replaceText(
            `${program}-installed-version`,
            apmJson.get(instPath, 'core.' + program, '未インストール') +
              '（ファイルの存在が確認できませんでした。）'
          );
        }
      } else {
        if (filesCount === existCount) {
          replaceText(`${program}-installed-version`, '手動インストール済み');
        } else {
          replaceText(`${program}-installed-version`, '未インストール');
        }
      }
    }
  } else {
    for (const program of ['aviutl', 'exedit']) {
      replaceText(`${program}-installed-version`, '未取得');
    }
  }

  if (store.has('modDate.core')) {
    const modDate = new Date(store.get('modDate.core'));
    replaceText('core-mod-date', modDate.toLocaleString());

    const checkDate = new Date(store.get('checkDate.core'));
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
      shortcut.addAviUtlShortcut(appDataPath, aviutlPath);
    } else {
      shortcut.removeAviUtlShortcut(appDataPath);
    }
  }
}

/**
 * Returns an object parsed from core.json.
 *
 * @returns {Promise<Core>} - An object parsed from core.json.
 */
async function getCoreInfo() {
  const coreFile = await existsTempFile(
    path.join('core', path.basename(await modList.getCoreDataUrl()))
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
 *
 * @param {string} instPath - An installation path.
 */
async function setCoreVersions(instPath) {
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
    for (const program of ['aviutl', 'exedit']) {
      replaceText(`${program}-latest-version`, '未取得');
    }
    return;
  }

  const installAviutlBtn = document.getElementById('install-aviutl');
  const installExeditBtn = document.getElementById('install-exedit');
  for (const program of ['aviutl', 'exedit']) {
    /** @type {Program} */
    const progInfo = coreInfo[program];
    replaceText(`${program}-latest-version`, progInfo.latestVersion);

    for (const release of progInfo.releases) {
      const li = document.createElement('li');
      const anchor = document.createElement('a');
      anchor.classList.add('dropdown-item');
      anchor.href = '#';
      anchor.innerText =
        release.version +
        (release.version.includes('rc') ? '（テスト版）' : '') +
        (release.version === progInfo.latestVersion ? '（最新版）' : '');
      li.appendChild(anchor);

      if (program === 'aviutl') {
        anchor.addEventListener('click', async () => {
          await installProgram(
            installAviutlBtn,
            program,
            release.version,
            instPath
          );
        });
        aviutlVersionSelect.appendChild(li);
      } else if (program === 'exedit') {
        anchor.addEventListener('click', async () => {
          await installProgram(
            installExeditBtn,
            program,
            release.version,
            instPath
          );
        });
        exeditVersionSelect.appendChild(li);
      }
    }
  }
}

/**
 * Checks the latest versionof programs.
 *
 * @param {string} instPath - An installation path.
 */
async function checkLatestVersion(instPath) {
  const btn = document.getElementById('check-core-version');
  const enableButton = buttonTransition.loading(btn, '更新');

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
 *
 * @param {HTMLInputElement} input - A HTMLElement of input.
 */
async function selectInstallationPath(input) {
  const originalPath = input.value;
  const selectedPath = await openDirDialog(
    'インストール先フォルダを選択',
    originalPath
  );
  if (selectedPath.length !== 0 && selectedPath[0] !== originalPath) {
    const instPath = selectedPath[0];
    await changeInstallationPath(instPath);
    input.value = instPath;
  }
}

/**
 * Change the installation path.
 *
 * @param {string} instPath - An installation path.
 */
async function changeInstallationPath(instPath) {
  store.set('installationPath', instPath);

  // update 1
  await modList.updateInfo();
  const currentMod = await modList.getInfo();

  if (fs.existsSync(instPath)) {
    // migration
    await migration2to3.byFolder(instPath);

    if (fs.existsSync(apmJson.getPath(instPath)) && currentMod.convert) {
      const oldConvertMod = new Date(apmJson.get(instPath, 'convertMod', 0));
      const currentConvertMod = new Date(currentMod.convert.modified).getTime();

      if (oldConvertMod.getTime() < currentConvertMod)
        await convertId(instPath, currentConvertMod);
    }
  }

  // update 2
  const oldScriptsMod = new Date(store.get('modDate.scripts', 0));
  const oldCoreMod = new Date(store.get('modDate.core', 0));
  const oldPackagesMod = new Date(store.get('modDate.packages', 0));

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
 *
 * @param {HTMLButtonElement} btn - A HTMLElement of clicked button.
 * @param {string} program - A program name to install.
 * @param {string} version - A version to install.
 * @param {string} instPath - An installation path.
 */
async function installProgram(btn, program, version, instPath) {
  const enableButton = btn ? buttonTransition.loading(btn) : null;

  if (!instPath) {
    log.error('An installation path is not selected.');
    if (btn) {
      buttonTransition.message(
        btn,
        'インストール先フォルダを指定してください。',
        'danger'
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
        'danger'
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
    return;
  }

  /** @type {Program} */
  const progInfo = coreInfo[program];
  const url = progInfo.releases.find((r) => r.version === version).url;
  let archivePath = await download(url, { loadCache: true, subDir: 'core' });

  if (!archivePath) {
    log.error('Failed downloading a file.');
    if (btn) {
      buttonTransition.message(
        btn,
        'ダウンロード中にエラーが発生しました。',
        'danger'
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
    return;
  }

  const integrityForArchive = progInfo.releases.find(
    (r) => r.version === version
  ).integrity.archive;

  if (integrityForArchive) {
    // Verify file integrity
    while (!(await integrity.verifyFile(archivePath, integrityForArchive))) {
      const dialogResult = await openYesNoDialog(
        'エラー',
        'ダウンロードされたファイルは破損しています。再ダウンロードしますか？'
      );

      if (!dialogResult) {
        log.error(`The downloaded archive file is corrupt. URL:${url}`);
        if (btn) {
          buttonTransition.message(
            btn,
            'ダウンロードされたファイルは破損しています。',
            'danger'
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
            'danger'
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
    copySync(unzippedPath, instPath);

    let filesCount = 0;
    let existCount = 0;
    for (const file of progInfo.files) {
      if (!file.isUninstallOnly) {
        filesCount++;
        if (fs.existsSync(path.join(instPath, file.filename))) {
          existCount++;
        }
      }
    }

    if (filesCount !== existCount) {
      throw new Error('Could not verify that the files was installed.');
    }

    apmJson.setCore(instPath, program, version);
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
 *
 * @param {string} instPath - An installation path.
 */
async function batchInstall(instPath) {
  const btn = document.getElementById('batch-install');
  const enableButton = buttonTransition.loading(btn, 'インストール');

  if (!instPath) {
    log.error('An installation path is not selected.');
    if (btn) {
      buttonTransition.message(
        btn,
        'インストール先フォルダを指定してください。',
        'danger'
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
    return;
  }

  try {
    const coreInfo = await getCoreInfo();
    for (const program of ['aviutl', 'exedit']) {
      /** @type {Program} */
      const progInfo = coreInfo[program];
      await installProgram(null, program, progInfo.latestVersion, instPath);
    }
    const allPackages = packageUtil.getPackagesExtra(
      await packageMain.getPackages(instPath),
      instPath
    ).packages;
    const packages = allPackages.filter(
      (p) =>
        p.info.directURL &&
        p.installationStatus === packageUtil.states.notInstalled
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
