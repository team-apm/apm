import { app, dialog } from 'electron';
import log from 'electron-log/main';
import prompt from 'electron-prompt';
import fs, { readdir, unlink, writeJson } from 'fs-extra';
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

/** 移行前のユーザーデータの退避先(`{userData}/Data/` からの相対)。 */
const BACKUP_SUBDIR = 'migration';

/** 移行対象の dataVersion。キーが無い場合は v1。 */
const OLD_DATA_VERSIONS = ['1', '2'];

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
 * Converts the local repository into the v3 `packages.json`.
 * v1 は packages_list.xml、v2 は packages.xml という名前だったが XML の形式は
 * 同じなので、見つかった方をそのまま同じ変換に流す(旧実装はリネームしてから
 * 変換していた)。
 * @param {Installation} inst - The target installation.
 * @returns {Promise<void>} A promise that resolves when the conversion ends.
 */
async function convertLocalRepository(inst: Installation): Promise<void> {
  const xmlPath = ['packages.xml', 'packages_list.xml']
    .map((name) => path.join(inst.path, name))
    .find((candidate) => fs.existsSync(candidate));
  if (!xmlPath) return;

  // パース失敗は従来どおり呼び出し元へ伝播させる(try の外に置く)。
  // 変換・書き込みの失敗のみログに留めて続行する
  const packagesList = parsePackagesXml(fs.readFileSync(xmlPath, 'utf-8'));
  try {
    await writeJson(
      inst.localRepoPath,
      convertPackagesV2toV3(Object.values(packagesList)),
    );
  } catch (e) {
    log.error(e);
  }
}

/**
 * Migrates the AviUtl installation folder to v3.
 * @param {ServiceContext} ctx - The service context.
 * @param {Installation} inst - The target installation.
 * @returns {Promise<void>} A promise that resolves when the migration ends.
 */
export async function migrationByFolder(
  ctx: ServiceContext,
  inst: Installation,
): Promise<void> {
  const { win } = ctx;
  const jsonPath = Ledger.getPath(inst.path);
  if (!fs.existsSync(jsonPath)) return;

  const ledger = await inst.ledger();
  // dataVersion キーが無いのが v1
  const version = (await ledger.get('dataVersion')) as string | undefined;
  if (version !== undefined && !OLD_DATA_VERSIONS.includes(version)) return;

  log.info(`Start migration: migrationByFolder(${inst.path})`);

  // 1. apm.json を退避する。取れなかったときに破壊的な書き換えへ進まないよう
  //    戻り値を見る(downloadFile は失敗を undefined で返す)
  const backup = await downloadFile(win, jsonPath, {
    subDir: BACKUP_SUBDIR,
    keyText: jsonPath,
  });
  if (!backup) {
    throw new Error(`Failed to back up ${jsonPath} before the migration.`);
  }

  await ledger.transaction(async () => {
    // 2. repository は v3 のデータモデルに無い。v1 の値も v2 の値も使わない
    //    ので、旧実装のような URL 置換はせず削除だけする
    const packages = (await ledger.get('packages')) as {
      [key: string]: { repository?: string };
    };
    for (const id of Object.keys(packages)) {
      delete packages[id].repository;
    }
    await ledger.set('packages', packages);
    await ledger.set('dataVersion', '3');
  });

  // 3. ローカルリポジトリの変換は apm.json の確定後に行う
  await convertLocalRepository(inst);

  log.info(`End of migration: migrationByFolder(${inst.path})`);
}
