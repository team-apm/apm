import { Scripts } from 'apm-schema';
import log from 'electron-log/renderer';
import * as matcher from 'matcher';
import ApmJson from '../../lib/ApmJson';
import * as buttonTransition from '../../lib/buttonTransition';
import { getConfig } from '../../lib/Config';
import {
  app,
  clipboardWriteText,
  openBrowser,
  openPath,
} from '../../lib/ipcWrapper';
import * as modList from '../../lib/modList';
import * as parseJson from '../../lib/parseJson';
import replaceText from '../../lib/replaceText';
import { trpc } from '../../lib/trpcClient';
import { shareStringVersion } from '../../shared/shareString';
import { PackageItem } from '../../types/packageItem';
import { programs } from './common';
import packageUtil from './packageUtil';

const config = getConfig();

// To avoid a bug in the library
// https://github.com/sindresorhus/matcher/issues/32
const isMatch = (
  input: string | readonly string[],
  pattern: readonly string[],
) => pattern.some((p) => matcher.isMatch(input, p));

let selectedEntry: PackageItem | Scripts['webpage'][number];
let selectedEntryType: string;
const entryType = { package: 'package', scriptSite: 'script' };

// Functions to be exported

/**
 * Get packages
 * @param {string} instPath - An installation path
 * @returns {Promise.<object[]>} An object of packages
 */
async function getPackages(instPath: string) {
  return await packageUtil.getPackages(instPath);
}

/**
 * Requests the React list (PackagesTab) to refresh, and updates the legacy
 * parts that are not migrated yet (batch-install text and mod dates).
 * 一覧の描画・ソート・検索・フィルタは React 側(packages/PackagesTab.tsx)へ
 * 移設済み。
 * @param {string} instPath - An installation path.
 */
async function setPackagesList(instPath: string) {
  // 隔離ワールドの DOM イベントはメインワールドに届くため、これで React 側が
  // tRPC クエリを再取得する
  window.dispatchEvent(new Event('apm-packages-changed'));
  await updateBatchInstallList(instPath);
  updateModDates();
}

/**
 * Updates the batch installation text in the AviUtl tab.
 * @param {string} instPath - An installation path.
 */
async function updateBatchInstallList(instPath: string) {
  const packages = (await packageUtil.getPackagesWithStatus(instPath)).packages;
  const batchInstallElm = document.getElementById('batch-install-packages');
  [...batchInstallElm.getElementsByClassName('batch-install-package')].map(
    (e) => e.remove(),
  );
  packages
    .filter((p) => p.info.directURL)
    .map((p) => {
      const liTag = document
        .getElementById('batch-install-package-template')
        .cloneNode(true) as HTMLSpanElement;
      liTag.removeAttribute('id');
      (liTag.getElementsByClassName('name')[0] as HTMLElement).innerText =
        p.info.name;
      (
        liTag.getElementsByClassName('installed-version')[0] as HTMLElement
      ).innerText = p.installationStatus;
      return liTag;
    })
    .forEach((e) => batchInstallElm.appendChild(e));
}

/**
 * Updates the mod dates in the settings page.
 */
function updateModDates() {
  if (config.modDate.hasPackages()) {
    const modDate = new Date(config.modDate.getPackages());
    replaceText('packages-mod-date', modDate.toLocaleString());

    const checkDate = new Date(config.checkDate.getPackages());
    replaceText('packages-check-date', checkDate.toLocaleString());
  } else {
    replaceText('packages-mod-date', '未取得');

    replaceText('packages-check-date', '未確認');
  }
}

/**
 * Sets the selected entry. Called from the React list via packagesBridge.
 * 旧 setPackagesList 内の li クリックハンドラに相当する。
 * @param {string} type - The entry type ('package' or 'script').
 * @param {object} entry - The selected package or script-site webpage.
 */
function setSelectedEntry(
  type: string,
  entry: PackageItem | Scripts['webpage'][number],
) {
  selectedEntry = entry;
  selectedEntryType = type;
  if (type === entryType.package) {
    replaceText(
      'install-package',
      (entry as PackageItem).installationStatus?.startsWith(
        packageUtil.states.installed,
      )
        ? '　　更新　　'
        : 'インストール',
    );
  } else {
    replaceText('install-package', 'インストール');
  }
}

/**
 * Installs the package of the given id. Called from the React list
 * (要導入 link) via packagesBridge.
 * @param {string} instPath - An installation path.
 * @param {string} packageId - The id of the package to install.
 */
async function installPackageById(instPath: string, packageId: string) {
  const packages = (await packageUtil.getPackagesWithStatus(instPath)).packages;
  const packageToInstall = packages.find((p) => p.id === packageId);
  if (!packageToInstall) {
    log.error(`The package to install is not found. ID:${packageId}`);
    return;
  }
  await installPackage(instPath, packageToInstall);
}

/**
 * Checks the packages list.
 * @param {string} instPath - An installation path.
 */
async function checkPackagesList(instPath: string) {
  const btn = document.getElementById(
    'check-packages-list',
  ) as HTMLButtonElement;
  const enableButton = btn
    ? buttonTransition.loading(btn, '更新').enableButton
    : undefined;

  const overlay = document.getElementById('packages-table-overlay');
  if (overlay) {
    overlay.style.zIndex = '1000';
    overlay.classList.add('show');
  }

  try {
    await modList.updateInfo();
    await packageUtil.downloadRepository(instPath);
    config.checkDate.setPackages(Date.now());
    const modInfo = await modList.getInfo();
    config.modDate.setPackages(
      Math.max(...modInfo.packages.map((p) => new Date(p.modified).getTime())),
    );
    await setPackagesList(instPath);

    if (btn) buttonTransition.message(btn, '更新完了', 'success');
  } catch (e) {
    log.error(e);
    if (btn) buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
  }

  if (overlay) {
    overlay.classList.remove('show');
    overlay.style.zIndex = '-1';
  }

  if (btn) {
    setTimeout(() => {
      enableButton();
    }, 3000);
  }
}

/**
 * Checks the scripts list.
 * 取得・キャッシュ・更新日時の記録は main プロセス側(services/packages.ts)へ移設済み。
 * @param {boolean} update - Download the json file.
 * @returns {Promise<Scripts>} - An object parsed from scripts.json.
 */
async function getScriptsList(update = false) {
  return (await trpc.packages.getScriptsList.query({ update })) as {
    webpage: Scripts['webpage'];
    scripts: Scripts['scripts'];
  };
}

/**
 * Installs a package to installation path.
 * @param {string} instPath - An installation path.
 * @param {object} [packageToInstall] - A package to install.
 * @param {boolean} [direct] - Install from the direct link to the zip.
 * @param {string} [strArchivePath] - Path to the downloaded archive.
 */
async function installPackage(
  instPath: string,
  packageToInstall?: PackageItem,
  direct = false,
  strArchivePath?: string,
) {
  const roles = {
    Event_Handler: 'Event_Handler',
    Internal_Local_File: 'Internal_Local_File',
    Internal_Direct_Link: 'Internal_Direct_Link',
    Internal_Browser: 'Internal_Browser',
  };
  let role;
  if (strArchivePath) {
    role = roles.Internal_Local_File;
  } else if (direct) {
    role = roles.Internal_Direct_Link;
  } else if (packageToInstall) {
    role = roles.Internal_Browser;
  } else {
    role = roles.Event_Handler;
  }

  if (
    role === roles.Event_Handler &&
    selectedEntryType === entryType.scriptSite
  ) {
    await installScript(instPath);
    return;
  }

  const btn = document.getElementById('install-package') as HTMLButtonElement;
  const { enableButton } = btn
    ? buttonTransition.loading(btn, 'インストール')
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

  let installedPackage: PackageItem;

  if (packageToInstall) {
    installedPackage = { ...packageToInstall };
  } else {
    if (!selectedEntry) {
      log.error('A package to install is not selected.');
      if (btn) {
        buttonTransition.message(
          btn,
          'プラグインまたはスクリプトを選択してください。',
          'danger',
        );
        setTimeout(() => {
          enableButton();
        }, 3000);
      }
      return;
    }

    if ((selectedEntry as PackageItem).id?.startsWith('script_')) {
      log.error('This script cannot be overwritten.');
      if (btn) {
        buttonTransition.message(
          btn,
          'このスクリプトは上書きインストールできません。',
          'danger',
        );
        setTimeout(() => {
          enableButton();
        }, 3000);
      }
      return;
    }

    installedPackage = { ...selectedEntry } as PackageItem;
  }

  // アーカイブの解決(直リンク DL・整合性ダイアログ・ブラウザ DL)と
  // 展開・配置・apm.json 記録は main プロセス側(services/packages.ts)へ移設済み
  let result: Awaited<ReturnType<typeof trpc.packages.installPackage.mutate>>;
  try {
    result = await trpc.packages.installPackage.mutate({
      instPath,
      packageItem: { id: installedPackage.id, info: installedPackage.info },
      direct: role === roles.Internal_Direct_Link,
      archivePath:
        role === roles.Internal_Local_File ? strArchivePath : undefined,
    });
  } catch (e) {
    log.error(e);
    result = 'installFailed';
  }

  if (result === 'canceled') {
    if (btn) {
      buttonTransition.message(
        btn,
        'インストールがキャンセルされました。',
        'info',
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
    return;
  }

  if (result === 'downloadFailed') {
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

  if (result === 'corrupt') {
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
    // Direct installation can throw an error because it is called only from within the try catch block.
    throw new Error('The downloaded archive file is corrupt.');
  }

  if (result === 'redownloadFailed') {
    if (btn) {
      buttonTransition.message(
        btn,
        'ファイルのダウンロードに失敗しました。',
        'danger',
      );
      setTimeout(() => {
        enableButton();
      }, 3000);
    }
    // Direct installation can throw an error because it is called only from within the try catch block.
    throw new Error('Failed downloading the archive file.');
  }

  if (result === 'success') {
    await setPackagesList(instPath);

    if (btn) buttonTransition.message(btn, 'インストール完了', 'success');
  } else {
    if (btn) buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
  }

  if (btn) {
    setTimeout(() => {
      enableButton();
    }, 3000);
  }
}

/**
 * Uninstalls a package to installation path.
 * @param {string} instPath - An installation path.
 */
async function uninstallPackage(instPath: string) {
  const btn = document.getElementById('uninstall-package') as HTMLButtonElement;
  const { enableButton } = buttonTransition.loading(btn, 'アンインストール');

  if (selectedEntryType !== entryType.package) {
    log.error('A package to install is not selected.');
    buttonTransition.message(
      btn,
      'プラグインまたはスクリプトを選択してください。',
      'danger',
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  if (!instPath) {
    log.error('An installation path is not selected.');
    buttonTransition.message(
      btn,
      'インストール先フォルダを指定してください。',
      'danger',
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  if (!selectedEntry) {
    log.error('A package to install is not selected.');
    buttonTransition.message(
      btn,
      'プラグインまたはスクリプトを選択してください。',
      'danger',
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  const uninstalledPackage = { ...selectedEntry } as PackageItem;

  // ファイル削除と apm.json からの削除は main プロセス側
  // (services/packages.ts)へ移設済み
  let result: Awaited<ReturnType<typeof trpc.packages.uninstallPackage.mutate>>;
  try {
    result = await trpc.packages.uninstallPackage.mutate({
      instPath,
      packageItem: { id: uninstalledPackage.id, info: uninstalledPackage.info },
    });
  } catch (e) {
    log.error(e);
    result = 'removeFailed';
  }

  if (result === 'removeFailed') {
    buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  if (result === 'success') {
    if (!uninstalledPackage.id.startsWith('script_')) {
      await setPackagesList(instPath);
    } else {
      await parseJson.removePackage(
        modList.getLocalPackagesDataUrl(instPath),
        uninstalledPackage,
      );
      await checkPackagesList(instPath);
    }

    buttonTransition.message(btn, 'アンインストール完了', 'success');
  } else {
    buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
  }

  setTimeout(() => {
    enableButton();
  }, 3000);
}

/**
 * Open the download folder of the package.
 */
async function openPackageFolder() {
  const btn = document.getElementById(
    'open-package-folder',
  ) as HTMLButtonElement;
  const { enableButton } = buttonTransition.loading(
    btn,
    'ダウンロードフォルダ',
  );

  if (selectedEntryType !== entryType.package) {
    log.error('A package to install is not selected.');
    buttonTransition.message(
      btn,
      'プラグインまたはスクリプトを選択してください。',
      'danger',
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  if (!selectedEntry) {
    log.error('A package to install is not selected.');
    buttonTransition.message(
      btn,
      'プラグインまたはスクリプトを選択してください。',
      'danger',
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  const exists = await openPath(`package/${(selectedEntry as PackageItem).id}`);

  if (!exists) {
    log.error('The package has not been downloaded.');
    buttonTransition.message(
      btn,
      'このパッケージはダウンロードされていません。',
      'danger',
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  setTimeout(() => {
    enableButton();
  }, 3000);
}

/**
 * Installs a script to installation path.
 * @param {string} instPath - An installation path.
 */
async function installScript(instPath: string) {
  const btn = document.getElementById('install-package') as HTMLButtonElement;
  const { enableButton } = buttonTransition.loading(btn);
  const url = (selectedEntry as Scripts['webpage'][number]).url;

  if (!instPath) {
    log.error('An installation path is not selected.');
    buttonTransition.message(
      btn,
      'インストール先フォルダを指定してください。',
      'danger',
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  const downloadResult = await openBrowser(url, 'package');
  if (!downloadResult) {
    log.info('The installation was canceled.');
    buttonTransition.message(
      btn,
      'インストールがキャンセルされました。',
      'info',
    );
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  const archivePath = downloadResult.savePath;
  const history = downloadResult.history;
  const matchInfo = [...(await getScriptsList()).scripts]
    .reverse()
    .find((item) => isMatch(history, item.match));

  if (!matchInfo) {
    log.error('The script is not supported.');
    buttonTransition.message(btn, '未対応のスクリプトです。', 'danger');
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  if ('redirect' in matchInfo) {
    // Determine which of the redirections can be installed and install them.
    const packages = (await packageUtil.getPackagesWithStatus(instPath))
      .packages;
    const packageId = matchInfo.redirect
      .split('|')
      .find((candidate: string) =>
        packages.find((p) => p.id === candidate && p.doNotInstall !== true),
      );
    if (packageId) {
      await installPackage(
        instPath,
        packages.find((p) => p.id === packageId),
        undefined,
        archivePath,
      );
    } else {
      buttonTransition.message(
        btn,
        '指定されたパッケージは存在しません。',
        'danger',
      );
    }
    setTimeout(() => {
      enableButton();
    }, 3000);
    return;
  }

  // 展開 → スクリプト検証 → 配置 → パッケージ情報の生成と保存は
  // main プロセス側(services/packages.ts)へ移設済み
  let result: Awaited<
    ReturnType<typeof trpc.packages.installScriptArchive.mutate>
  >;
  try {
    result = await trpc.packages.installScriptArchive.mutate({
      instPath,
      archivePath,
      url,
      matchInfo: {
        folder: matchInfo.folder,
        developer: matchInfo.developer,
        dependencies: matchInfo.dependencies,
      },
    });
  } catch (e) {
    log.error(e);
    result = 'installFailed';
  }

  if (result === 'noScript') {
    buttonTransition.message(btn, 'スクリプトが含まれていません。', 'danger');
  } else if (result === 'containsPlugin') {
    buttonTransition.message(
      btn,
      'プラグインが含まれているためインストールできません。',
      'danger',
    );
  } else if (result === 'success') {
    await checkPackagesList(instPath);
    buttonTransition.message(btn, 'インストール完了', 'success');
  } else {
    buttonTransition.message(btn, 'エラーが発生しました。', 'danger');
  }

  setTimeout(() => {
    enableButton();
  }, 3000);
}

/**
 * Returns a nicommonsID list separated by space.
 * @param {string} instPath - An installation path.
 */
async function sharePackages(instPath: string) {
  const btn = document.getElementById('share-packages') as HTMLButtonElement;
  const { enableButton } = btn
    ? buttonTransition.loading(btn, '共有')
    : { enableButton: null };

  const ver = {
    share: shareStringVersion, // version of this data
    apm: await app.getVersion(),
    aviutl: '',
    exedit: '',
    packages: [''],
  };

  const apmJson = await ApmJson.load(instPath);

  for (const program of programs) {
    const currentVersion = (await apmJson.get('core.' + program)) as string;
    ver[program] = currentVersion;
  }
  ver.packages = (await packageUtil.getPackagesExtra(instPath)).packages
    .filter(
      (p) =>
        p.installationStatus === packageUtil.states.installed ||
        p.installationStatus === packageUtil.states.manuallyInstalled,
    )
    .map((p) => p.id)
    .filter((id) => id.includes('/'))
    .sort((a, b) => {
      const compare = (a: string, b: string) => (a > b ? 1 : a < b ? -1 : 0);
      const a2 = a.split('/');
      const b2 = b.split('/');
      return a2[0] === b2[0] ? compare(a2[1], b2[1]) : compare(a2[0], b2[0]);
    });
  await clipboardWriteText(
    //  Variation Selectors: 🍎️(color), 🎞︎(text), 🎬︎(text)
    `ここにタイトルを入力🍎️${ver.share}:${ver.apm},🎞︎${ver.aviutl},🎬︎${
      ver.exedit
    },${ver.packages.join(',')}`,
  );

  buttonTransition.message(btn, 'コピーしました', 'info');
  if (btn) {
    setTimeout(() => {
      enableButton();
    }, 3000);
  }
}

const packageMain = {
  getPackages,
  setPackagesList,
  checkPackagesList,
  getScriptsList,
  installPackage,
  uninstallPackage,
  openPackageFolder,
  installScript,
  setSelectedEntry,
  installPackageById,
  sharePackages,
};
export default packageMain;
