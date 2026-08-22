import { app, dialog } from 'electron';
import log from 'electron-log/main';
import fs, { readdir, unlink, writeJson } from 'fs-extra';
import path from 'node:path';
import { convertPackagesV2toV3 } from '../../shared/convertPackagesV2toV3';
import { parsePackagesXml } from '../../shared/parsePackagesXml';
import type { Installation } from '../installation';
import Ledger from '../Ledger';
import { downloadFile } from './download';
import type { ServiceContext } from './serviceContext';

// v1 / v2 のユーザーデータを v3 の形へ一度で変換する。
// 段(1→2→3)を踏まないのは、v2 の中間状態を後段が必ず捨てるため。旧実装は
// v1→2 で dataURL と apm.json の repository を書き換え、v2→3 でその両方を
// 削除しており、入力した値も置換した値も最終状態には残らなかった。
// 移行は片道で、旧形式へ戻す経路は用意しない(AGENTS.md の確定方針)。

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
 * Migrates the common settings to v3.
 * @param {ServiceContext} ctx - The service context.
 * @returns {Promise<void>} A promise that resolves when the migration ends.
 */
export async function migrationGlobal(ctx: ServiceContext): Promise<void> {
  const { win, config } = ctx;

  // 初回起動。取得先がまだ無い = 移行するユーザーデータが無い
  if (!config.dataUrl.hasMain()) {
    config.setDataVersion('3');
    return;
  }
  // dataVersion キーが無いのが v1。値があるなら移行対象かどうかで判断する
  if (
    config.hasDataVersion() &&
    !OLD_DATA_VERSIONS.includes(config.getDataVersion())
  )
    return;

  log.info('Start migration: migrationGlobal()');

  // 1. config.json を退避する。apm.json と違いバックアップの仕組みが無く、
  //    カスタムのデータ取得先は再入力に外部の情報が要るため
  const oldDataUrl = config.dataUrl.getMain();
  await downloadFile(win, path.join(app.getPath('userData'), 'config.json'), {
    subDir: BACKUP_SUBDIR,
  });

  // 2. Delete the cache files
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

  // 3. 取得先と更新日時をリセットする。既定値を書かずに削除だけするのは、
  //    「未設定なら既定値」の解決を startup の initSettings 一箇所に保つため
  config.delete('dataURL');
  config.delete('modDate');
  config.delete('checkDate');

  config.setDataVersion('3');
  await dialog.showMessageBox({
    title: 'アップデート',
    message: [
      'お使いのデータが古い形式のため、新しい形式へ移行しました。',
      'これに伴いデータ取得先がリセットされました。デフォルト以外のURLを設定していた場合は、設定タブから再設定してください。',
      '',
      `これまでの取得先: ${oldDataUrl}`,
    ].join('\n'),
    type: 'info',
  });
  log.info('End of migration: migrationGlobal()');
}

/**
 * Converts the local repository into the v3 `packages.json`.
 * v1 は packages_list.xml、v2 は packages.xml という名前だったが XML の形式は
 * 同じなので、見つかった方をそのまま同じ変換に流す(旧実装はリネームしてから
 * 変換していた)。
 * パース失敗で移行を止めないのは、手書きの XML が 1 つ壊れているだけで
 * apm.json の移行が毎起動やり直しになるため。元の XML は消さずに残し、
 * 変換できなかったことをユーザーへ知らせる。
 * @param {Installation} inst - The target installation.
 * @returns {Promise<void>} A promise that resolves when the conversion ends.
 */
async function convertLocalRepository(inst: Installation): Promise<void> {
  const xmlPath = ['packages.xml', 'packages_list.xml']
    .map((name) => path.join(inst.path, name))
    .find((candidate) => fs.existsSync(candidate));
  if (!xmlPath) return;

  try {
    const packagesList = parsePackagesXml(fs.readFileSync(xmlPath, 'utf-8'));
    await writeJson(
      inst.localRepoPath,
      convertPackagesV2toV3(Object.values(packagesList)),
    );
  } catch (e) {
    log.error(e);
    await showErrorDialog(
      'エラー',
      `ローカルリポジトリを新しい形式へ変換できませんでした。\n${xmlPath}\n元のファイルは残してあります。内容を確認して登録しなおしてください。`,
    );
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
