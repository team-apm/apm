import { app, shell } from 'electron';
import log from 'electron-log/main';
import { existsSync, readdir as fsReaddir, mkdir, rename } from 'fs-extra';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { isParent, resolveInside } from '../../shared/apmPath';
import { install, verifyFilesByCount } from '../../shared/install';
import { buildInstallerArgs } from '../../shared/installerArgs';
import unzip from '../../shared/unzip';
import { PackageState } from '../../types/packageState';
import type { Installation } from '../installation';
import { openBrowser } from './browser';
import { downloadFile } from './download';
import { runInstallFlow } from './installFlow';
import type { ServiceContext } from './serviceContext';

/**
 * Get the date today
 * 旧 src/renderer/main/package.ts の getDate と同一の挙動。
 * @returns {string} Today's date
 */
export function getDate() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(
    2,
    '0',
  )}/${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Unzips (or moves) the downloaded archive, installs the files and records
 * the package in the ledger.
 * 旧 src/renderer/main/package.ts の installPackage 後半
 * (展開 → インストーラ実行または配置 → 検証 → 導入記録への記帳)と同一の挙動。
 * @param {Installation} inst - The target installation.
 * @param {string} archivePath - Path to the downloaded archive.
 * @param {object} packageState - A package to install.
 * @returns {Promise<boolean>} Whether the installation succeeded.
 */
export async function installPackageArchive(
  inst: Installation,
  archivePath: string,
  packageState: Pick<PackageState, 'id' | 'info'>,
): Promise<boolean> {
  let installResult = false;

  try {
    const getUnzippedPath = async () => {
      if (['.zip', '.lzh', '.7z', '.rar'].includes(path.extname(archivePath))) {
        return await unzip(archivePath, packageState.id);
      } else {
        // In this line, path.dirname(archivePath) always refers to the 'Data/package' folder.
        // packageState.id はリモート由来なので、展開経路(unzip)と同じく
        // データフォルダの外を指していないか確かめてから作る
        const newFolder = resolveInside(
          path.dirname(archivePath),
          packageState.id,
        );
        await mkdir(newFolder, { recursive: true });
        await rename(
          archivePath,
          path.join(newFolder, path.basename(archivePath)),
        );
        return newFolder;
      }
    };

    const unzippedPath = await getUnzippedPath();

    if (packageState.info.installer) {
      const searchFiles = async (dirName: string) => {
        let result: string[][] = [];
        const dirents = await fsReaddir(dirName, {
          withFileTypes: true,
        });
        for (const dirent of dirents) {
          if (dirent.isDirectory()) {
            const childResult = await searchFiles(
              path.join(dirName, dirent.name),
            );
            result = result.concat(childResult);
          } else {
            if (dirent.name === packageState.info.installer) {
              result.push([path.join(dirName, dirent.name)]);
              break;
            }
          }
        }
        return result;
      };

      const exePath = await searchFiles(unzippedPath);
      // シェルを介さないため installArg のメタ文字がコマンドとして解釈されない
      execFileSync(
        exePath[0][0],
        buildInstallerArgs(packageState.info.installArg, inst.path),
      );

      installResult = verifyFilesByCount(inst.path, packageState.info.files);
    } else {
      installResult = await install(
        unzippedPath,
        inst.path,
        packageState.info.files,
      );
    }
  } catch (e) {
    log.error(e);
    installResult = false;
  }

  if (installResult) {
    // isContinuous のパッケージはインストール日をバージョンとして記録する
    const latestVersion = packageState.info.isContinuous
      ? getDate()
      : packageState.info.latestVersion;
    const ledger = await inst.ledger();
    await ledger.addPackage(packageState.id, latestVersion);
  }

  return installResult;
}

export type InstallPackageResult =
  | 'success'
  | 'canceled'
  | 'downloadFailed'
  | 'corrupt'
  | 'redownloadFailed'
  | 'installFailed';

/**
 * Resolves the archive (local file / direct link / interactive browser) and
 * installs the package.
 * 旧 src/renderer/main/package.ts の installPackage のアーカイブ解決部分と
 * 同一の挙動。UI(ボタン遷移・メッセージ表示)は renderer 側に残る。
 * @param {ServiceContext} ctx - The service context.
 * @param {Installation} inst - The target installation.
 * @param {Pick<PackageState, 'id' | 'info'>} packageState - The package to install.
 * @param {object} [options] - Options.
 * @param {boolean} [options.direct] - Install from the direct link to the zip.
 * @param {string} [options.archivePath] - Path to the already-downloaded archive.
 * @returns {Promise<InstallPackageResult>} The result status.
 */
export async function installPackageFlow(
  ctx: ServiceContext,
  inst: Installation,
  packageState: Pick<PackageState, 'id' | 'info'>,
  { direct = false, archivePath }: { direct?: boolean; archivePath?: string },
): Promise<InstallPackageResult> {
  const { win } = ctx;
  return await runInstallFlow<
    'downloadFailed' | 'canceled' | 'redownloadFailed'
  >(win, {
    resolveArchive: async () => {
      if (archivePath) return { archivePath };
      if (direct) {
        // direct 指定なのに directURL を持たないパッケージは、この先の
        // ダウンロードで必ず失敗する
        const directURL = packageState.info.directURL;
        if (!directURL) {
          throw new Error(
            `The package has no direct URL. id:${packageState.id}`,
          );
        }
        const resolvedArchivePath = await downloadFile(win, directURL, {
          loadCache: true,
          subDir: 'package',
        });
        if (!resolvedArchivePath) {
          log.error('Failed downloading a file.');
          return { failure: 'downloadFailed' as const };
        }
        return { archivePath: resolvedArchivePath };
      }
      const downloadResult = await openBrowser(
        win,
        packageState.info.downloadURLs[0],
        'package',
      );
      if (downloadResult.status === 'closed') {
        log.info('The installation was canceled.');
        return { failure: 'canceled' as const };
      }
      if (downloadResult.status === 'failed') {
        log.error(
          `The download did not complete. URL:${packageState.info.downloadURLs[0]}`,
        );
        return { failure: 'downloadFailed' as const };
      }
      return { archivePath: downloadResult.savePath };
    },
    // integrity があるなら取得経路(直リンク・手動 DL・archivePath 渡し)に
    // よらず検証する。無いパッケージ(公式データの約 1/4)を弾かないのは、
    // 検証必須化すると既存パッケージのインストールが広く壊れるため
    integrity: packageState.info.releases?.find(
      (r) => r.version === packageState.info.latestVersion,
    )?.integrity?.archive,
    corruptLogUrl: packageState.info.directURL,
    redownloadArchive: async () => {
      if (direct) {
        const directURL = packageState.info.directURL;
        if (!directURL) {
          throw new Error(
            `The package has no direct URL. id:${packageState.id}`,
          );
        }
        // 再ダウンロード先が subDir 'core' なのは旧実装のままの挙動
        const resolvedArchivePath = await downloadFile(win, directURL, {
          subDir: 'core',
        });
        if (!resolvedArchivePath) {
          log.error(
            `Failed downloading the archive file. URL:${packageState.info.directURL}`,
          );
          return { failure: 'redownloadFailed' as const };
        }
        return { archivePath: resolvedArchivePath };
      }
      // 手動 DL・archivePath 渡しの経路はブラウザ窓での再取得になる
      const redownloadResult = await openBrowser(
        win,
        packageState.info.downloadURLs[0],
        'package',
      );
      if (redownloadResult.status === 'closed') {
        log.info('The installation was canceled.');
        return { failure: 'canceled' as const };
      }
      if (redownloadResult.status === 'failed') {
        log.error(
          `The re-download did not complete. URL:${packageState.info.downloadURLs[0]}`,
        );
        return { failure: 'redownloadFailed' as const };
      }
      return { archivePath: redownloadResult.savePath };
    },
    install: (resolvedArchivePath) =>
      installPackageArchive(inst, resolvedArchivePath, packageState),
  });
}

/**
 * Opens the download folder of the package, and returns whether it exists.
 * 旧 OPEN_PATH ハンドラに renderer が `package/${id}` を渡していた処理と
 * 同一の挙動(データフォルダ外の拒否も維持)。
 * @param {string} packageId - The id of the package.
 * @returns {Promise<boolean>} Whether the folder exists.
 */
export async function openPackageFolder(packageId: string): Promise<boolean> {
  const dataDir = path.join(app.getPath('userData'), 'Data/');
  const folderPath = path.join(dataDir, 'package', packageId);
  // packageId はリモート由来のため、データフォルダ外は拒否する
  if (!isParent(dataDir, folderPath)) {
    log.error(`Refused to open a path outside the data folder: ${packageId}`);
    return false;
  }
  const folderExists = existsSync(folderPath);
  if (folderExists) await shell.openPath(folderPath);
  return folderExists;
}
