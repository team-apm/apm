import { type BrowserWindow, dialog } from 'electron';
import log from 'electron-log/main';
import { verifyFile } from '../../shared/integrity';

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
 * @returns {Promise<'success' | 'corrupt' | 'installFailed' | TFailure>} The result status.
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
      const dialogResult = await dialog.showMessageBox(win, {
        title: 'エラー',
        message:
          'ダウンロードされたファイルは破損しています。再ダウンロードしますか？',
        type: 'warning',
        buttons: ['はい', 'いいえ'],
        cancelId: 1,
      });

      if (dialogResult.response !== 0) {
        log.error(
          `The downloaded archive file is corrupt. URL:${flow.corruptLogUrl}`,
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
