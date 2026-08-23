import { app, type BrowserWindow, dialog } from 'electron';
import log from 'electron-log/main';
import path from 'node:path';
import { verifyFile } from '../../shared/integrity';
import { safeRemove } from '../../shared/safeRemove';

/**
 * アーカイブ取得の結果。取得できたらそのパス、できなければ呼び出し元固有の
 * 失敗ステータス(downloadFailed / canceled 等)を返す。
 */
export type ArchiveResolution<TFailure extends string> =
  { archivePath: string } | { failure: TFailure };

/**
 * Runs the common install flow: resolve the archive, verify its integrity
 * (with a re-download loop), then install it.
 * installCoreProgram と installPackageFlow に重複していた同型骨格の一本化。
 * 取得経路・再取得経路・配置処理の挙動差は畳まず、コールバックとして
 * 呼び出し元に残す(ログ出力もそれぞれのコールバック側の責務)。
 * @param {BrowserWindow} win - A browser window used for dialogs.
 * @param {object} flow - The flow definition.
 * @param {() => Promise<ArchiveResolution<TFailure>>} flow.resolveArchive - Resolves the archive to install.
 * @param {string} [flow.integrity] - The ssri integrity of the archive. Skips verification if falsy.
 * @param {string} [flow.corruptLogUrl] - The URL logged when the user refuses to re-download.
 * @param {() => Promise<ArchiveResolution<TFailure>>} flow.redownloadArchive - Re-resolves the archive after a verification failure.
 * @param {(archivePath: string) => Promise<boolean>} flow.install - Installs the archive and returns whether it succeeded.
 * @returns {Promise<'success' | 'corrupt' | 'installFailed' | TFailure>} The result status ('corrupt' = the user aborted after an integrity mismatch).
 */
export async function runInstallFlow<TFailure extends string>(
  win: BrowserWindow,
  flow: {
    resolveArchive: () => Promise<ArchiveResolution<TFailure>>;
    integrity: string | undefined;
    corruptLogUrl: string | undefined;
    redownloadArchive: () => Promise<ArchiveResolution<TFailure>>;
    install: (archivePath: string) => Promise<boolean>;
  },
): Promise<'success' | 'corrupt' | 'installFailed' | TFailure> {
  const resolved = await flow.resolveArchive();
  if ('failure' in resolved) return resolved.failure;
  let archivePath = resolved.archivePath;

  if (flow.integrity) {
    while (!(await verifyFile(archivePath, flow.integrity))) {
      // apm は「ファイルが壊れている」と「apm のデータより新しい版が来た」を
      // 区別できない。integrity は latestVersion に紐づく 1 リリース分しか
      // 持たないのに、downloadURLs の多くは releases/latest(= 常に上流の
      // 最新)を指すため、apm-data が追いつくまでの間は正常なファイルでも
      // 必ず不一致になる。断定せずユーザーに選ばせる
      const dialogResult = await dialog.showMessageBox(win, {
        title: '確認',
        message:
          'ダウンロードしたファイルが、apm に登録されているものと一致しません。',
        detail:
          '配布元で新しい版が公開され、apm のデータが追いついていない可能性があります。\n' +
          'ファイルが壊れている、または別のファイルをダウンロードした可能性もあります。',
        type: 'warning',
        buttons: ['再ダウンロード', 'このままインストール', '中止'],
        defaultId: 0,
        cancelId: 2,
      });

      // 「このままインストール」。アーカイブは消さずに検証を抜ける
      if (dialogResult.response === 1) {
        log.warn(
          `Installing an archive that does not match the integrity. URL:${flow.corruptLogUrl}`,
        );
        break;
      }

      // ここから先はこのアーカイブを使わない。残さないのは、downloadFile の
      // loadCache が中身を見ずに既存ファイルを返すため — 置いたままだと
      // 次回以降のインストールが毎回このファイルを掴んで同じダイアログを
      // 出し続ける(中止したときは上書きも起きないため復帰できない)。
      // archivePath は必ず downloadFile か openBrowser の保存先で
      // userData/Data 配下にあり、ユーザーが指定したファイルではない
      try {
        await safeRemove(
          archivePath,
          path.join(app.getPath('userData'), 'Data'),
        );
      } catch (e) {
        log.error(e);
      }

      // 「中止」
      if (dialogResult.response !== 0) {
        log.error(
          `The downloaded archive does not match the integrity. URL:${flow.corruptLogUrl}`,
        );
        return 'corrupt';
      }

      const redownloaded = await flow.redownloadArchive();
      if ('failure' in redownloaded) return redownloaded.failure;
      archivePath = redownloaded.archivePath;
    }
  }

  try {
    return (await flow.install(archivePath)) ? 'success' : 'installFailed';
  } catch (e) {
    log.error(e);
    return 'installFailed';
  }
}
