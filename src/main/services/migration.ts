import { app, dialog } from 'electron';
import log from 'electron-log/main';
import prompt from 'electron-prompt';
import fs, { readdir, rename, unlink, writeJson } from 'fs-extra';
import path from 'node:path';
import { convertPackagesV2toV3 } from '../../shared/convertPackagesV2toV3';
import { joinUrlOrPath } from '../../shared/joinUrlOrPath';
import { parsePackagesXml } from '../../shared/parsePackagesXml';
import type { Installation } from '../installation';
import Ledger from '../Ledger';
import { downloadFile } from './download';
import type { ServiceContext } from './serviceContext';

// 旧 src/migration/(renderer 側)からの忠実な移植。ダイアログは
// IPC 経由(MIGRATION1TO2_* / OPEN_DIALOG)だったものを main 直呼びに
// 置き換えている。文言・選択肢・戻り値の意味は旧実装のまま

/**
 * Shows an error dialog. 旧 openDialog(IPC)と同じく親ウィンドウなしで開く。
 * @param {string} title - A title of the dialog.
 * @param {string} message - A message showed in the dialog.
 */
async function showErrorDialog(title: string, message: string) {
  await dialog.showMessageBox({
    title: title,
    message: message,
    type: 'error',
  });
}

/**
 * Migration of common settings from v1 to v2.
 * @param {ServiceContext} ctx - The service context.
 * @returns {Promise<boolean>} True on successful completion
 */
async function migration1to2Global(ctx: ServiceContext): Promise<boolean> {
  const { win, config } = ctx;
  // Guard condition
  const isVerOne = !config.hasDataVersion();
  if (!isVerOne) return true;

  // Show the dialogs for those using custom dataURL.main
  let useDefaultDataUrl = true;
  if (
    config.dataUrl.getMain() !==
    'https://cdn.jsdelivr.net/gh/team-apm/apm-data@main/data/'
  ) {
    for (;;) {
      const response = (
        await dialog.showMessageBox(win, {
          title: '確認',
          message: `お使いのバージョンのapmは現在設定されているデータ取得先に対応しておりません。新しいデータ取得先への移行が必要です。`,
          type: 'warning',
          buttons: [
            'キャンセル',
            '新しいデータ取得先を入力する',
            'デフォルトのデータ取得先を使う',
          ],
          cancelId: 0,
        })
      ).response;
      if (response === 0) {
        // quit
        return false;
      }
      if (response === 2) {
        // use default dataURL.main
        break;
      }
      // else (response === 1) // use new dataURL.main

      const newDataUrl = await prompt(
        {
          title: '新しいデータ取得先の入力',
          label: '新しいデータ取得先のURL（例: https://example.com/data/）',
          width: 500,
          height: 300,
          type: 'input',
        },
        win,
      );
      if (!newDataUrl) {
        continue;
      } else if (!newDataUrl.startsWith('http') && !fs.existsSync(newDataUrl)) {
        await showErrorDialog(
          'エラー',
          '有効なURLまたは場所を入力してください。',
        );
        continue;
      } else if (path.extname(newDataUrl) === '.xml') {
        await showErrorDialog('エラー', 'フォルダのURLを入力してください。');
        continue;
      } else {
        const oldDataUrl = config.dataUrl.getMain();
        const urls = config.dataUrl
          .getPackages()
          .filter((url) => !url.includes(oldDataUrl));
        urls.push(joinUrlOrPath(newDataUrl, 'packages.xml'));
        config.dataUrl.setMain(newDataUrl);
        config.dataUrl.setPackages(urls);
        config.set('migration1to2', {
          oldDataURL: oldDataUrl,
          newDataURL: newDataUrl,
        });
        useDefaultDataUrl = false;
        break;
      }
    }
  }

  // Main
  log.info('Start migration: migration1to2Global()');
  // 1. Delete the cache files
  const dataFolder = path.join(app.getPath('userData'), 'Data/');
  const files = [
    path.join(dataFolder, 'mod.xml'),
    path.join(dataFolder, 'core/core.xml'),
    ...(
      await readdir(path.join(dataFolder, 'package/'), {
        withFileTypes: true,
      })
    )
      .filter(
        (dirent) =>
          dirent.isFile() && dirent.name.endsWith('_packages_list.xml'),
      )
      .map(({ name }) => path.join(dataFolder, 'package/', name)),
  ];
  files.forEach(async (file) => {
    try {
      await unlink(file);
    } catch (e) {
      log.error(e);
    }
  });

  // 2. Triggers initialization
  config.delete('modDate');
  // 3. Triggers initialization
  // 旧実装の setMain(undefined) は conf が TypeError で拒否し、この移行が
  // 必ずクラッシュしていた(#2397)
  if (useDefaultDataUrl) config.dataUrl.deleteMain();

  // Finalize
  config.setDataVersion('2');
  log.info('End of migration: migration1to2Global()');
  return true;
}

/**
 * Migration of the AviUtl installation folder from v1 to v2.
 * @param {ServiceContext} ctx - The service context.
 * @param {Installation} inst - The target installation.
 */
async function migration1to2ByFolder(ctx: ServiceContext, inst: Installation) {
  const { win, config } = ctx;
  // Guard condition
  const jsonPath = Ledger.getPath(inst.path);
  const jsonExists = fs.existsSync(jsonPath);
  if (!jsonExists) return;

  const ledger = await inst.ledger();
  const isVerOne = !(await ledger.has('dataVersion'));
  if (!isVerOne) return;

  // Main
  log.info(`Start migration: migration1to2ByFolder(${inst.path})`);
  // packages の変換と dataVersion の更新を 1 回の書き込みで確定させる
  ledger.begin();

  // 1. Backup apm.json
  await downloadFile(win, jsonPath, {
    subDir: 'migration1to2',
    keyText: jsonPath,
  });

  // 2. Renaming the local repository
  try {
    if (fs.existsSync(path.join(inst.path, 'packages_list.xml'))) {
      await rename(
        path.join(inst.path, 'packages_list.xml'),
        path.join(inst.path, 'packages.xml'),
      );
    }
  } catch (e) {
    log.error(e);
  }

  // 3. Update the path to the online and local xml files.
  const packages = (await ledger.get('packages')) as {
    [key: string]: { repository: string };
  };

  for (const id of Object.keys(packages)) {
    let text = packages[id].repository;
    text = text.replaceAll(
      'apm-data@main\\data\\packages_list.xml',
      'apm-data@main\\v2\\data\\packages.xml',
    );
    text = text.replaceAll(
      'apm-data@main/data/packages_list.xml',
      'apm-data@main/v2/data/packages.xml',
    );
    text = text.replaceAll(
      path.join(inst.path, 'packages_list.xml'),
      path.join(inst.path, 'packages.xml'),
    );
    if (config.has('migration1to2')) {
      const dataUrls = config.get('migration1to2');
      text = text.replaceAll(
        joinUrlOrPath(dataUrls.oldDataURL, 'packages_list.xml'),
        joinUrlOrPath(dataUrls.newDataURL, 'packages.xml'),
      );
    }
    packages[id].repository = text;
  }

  await ledger.set('packages', packages);

  // Finalize
  await ledger.set('dataVersion', '2');
  await ledger.commit();
  log.info(`End of migration: migration1to2ByFolder(${inst.path})`);
}

/**
 * Migration of common settings up to v3.
 * @param {ServiceContext} ctx - The service context.
 * @returns {Promise<boolean>} True on successful completion
 */
export async function migrationGlobal(ctx: ServiceContext): Promise<boolean> {
  const { config } = ctx;
  const firstLaunch = !config.dataUrl.hasMain();
  if (firstLaunch) {
    config.setDataVersion('3');
    return true;
  }

  // First, perform the previous migration.
  // false cancels startup
  if (!(await migration1to2Global(ctx))) return false;

  // Guard condition
  // The 'dataVersion' is always present due to previous migrations.
  // version: '2' or '3' or later
  const version = config.getDataVersion();
  if (version !== '2') return true;

  // Main
  log.info('Start migration: migration2to3Global()');

  // 1. Triggers initialization
  config.delete('modDate');
  config.delete('checkDate');
  config.delete('dataURL');

  // Finalize
  config.setDataVersion('3');
  await dialog.showMessageBox({
    title: 'アップデート',
    message:
      'v2.x.xからv3.x.xへのアップデートに伴い、データ取得先がリセットされました。\nデフォルト以外のURLを設定していた場合は、再設定してください。',
    type: 'info',
  });
  log.info('End of migration: migration2to3Global()');
  return true;
}

/**
 * Migration of the AviUtl installation folder up to v3.
 * @param {ServiceContext} ctx - The service context.
 * @param {Installation} inst - The target installation.
 */
export async function migrationByFolder(
  ctx: ServiceContext,
  inst: Installation,
) {
  const jsonPath = path.join(inst.path, 'apm.json');
  const jsonExists = fs.existsSync(jsonPath);
  if (!jsonExists) return;

  await migration1to2ByFolder(ctx, inst);

  // Guard condition
  // The 'dataVersion' is always present due to previous migrations.
  // version: '2' or '3' or later
  const ledger = await inst.ledger();
  const version = (await ledger.get('dataVersion')) as string;
  if (version !== '2') return;

  // Main
  const { win } = ctx;
  log.info(`Start migration: migration2to3ByFolder(${inst.path})`);
  // packages の変換と dataVersion の更新を 1 回の書き込みで確定させる
  ledger.begin();

  // 1. Backup apm.json
  await downloadFile(win, jsonPath, {
    subDir: 'migration2to3',
    keyText: jsonPath,
  });

  // 2. Update the path to the online and local xml files.
  // repository は削除対象なので optional。必須と書くと delete が型で弾かれる
  const packages = (await ledger.get('packages')) as {
    [key: string]: { repository?: string };
  };
  for (const id of Object.keys(packages)) {
    if (Object.hasOwn(packages[id], 'repository'))
      delete packages[id].repository;
  }
  await ledger.set('packages', packages);

  // 3. Conversion of package.xml generated by the script installation function
  const packagesXML = path.join(inst.path, 'packages.xml');
  if (fs.existsSync(packagesXML)) {
    // パース失敗は従来どおり呼び出し元へ伝播させる(try の外に置く)。
    // 変換・書き込みの失敗のみログに留めて続行する
    const packagesList = parsePackagesXml(
      fs.readFileSync(packagesXML, 'utf-8'),
    );

    try {
      const newData = convertPackagesV2toV3(Object.values(packagesList));
      await writeJson(inst.localRepoPath, newData);
    } catch (e) {
      log.error(e);
    }
  }

  // Finalize
  await ledger.set('dataVersion', '3');
  await ledger.commit();
  log.info(`End of migration: migration2to3ByFolder(${inst.path})`);
}
