import { app, type BrowserWindow, shell } from 'electron';
import log from 'electron-log/main';
import { existsSync, readdir as fsReaddir, mkdir, rename } from 'fs-extra';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { isParent } from '../../shared/apmPath';
import { install, verifyFilesByCount } from '../../shared/install';
import { buildInstallerArgs } from '../../shared/installerArgs';
import unzip from '../../shared/unzip';
import { PackageState } from '../../types/packageState';
import ApmJson from '../ApmJson';
import type Config from '../Config';
import { openBrowser } from './browser';
import { downloadFile } from './download';
import { runInstallFlow } from './installFlow';

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
 * the package in apm.json.
 * 旧 src/renderer/main/package.ts の installPackage 後半
 * (展開 → インストーラ実行または配置 → 検証 → apm.json 記録)と同一の挙動。
 * @param {string} instPath - An installation path.
 * @param {string} archivePath - Path to the downloaded archive.
 * @param {object} packageItem - A package to install.
 * @returns {Promise<boolean>} Whether the installation succeeded.
 */
export async function installPackageArchive(
  instPath: string,
  archivePath: string,
  packageItem: Pick<PackageState, 'id' | 'info'>,
): Promise<boolean> {
  let installResult = false;

  try {
    const getUnzippedPath = async () => {
      if (['.zip', '.lzh', '.7z', '.rar'].includes(path.extname(archivePath))) {
        return await unzip(archivePath, packageItem.id);
      } else {
        // In this line, path.dirname(archivePath) always refers to the 'Data/package' folder.
        const newFolder = path.join(path.dirname(archivePath), packageItem.id);
        await mkdir(newFolder, { recursive: true });
        await rename(
          archivePath,
          path.join(newFolder, path.basename(archivePath)),
        );
        return newFolder;
      }
    };

    const unzippedPath = await getUnzippedPath();

    if (packageItem.info.installer) {
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
            if (dirent.name === packageItem.info.installer) {
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
        buildInstallerArgs(packageItem.info.installArg, instPath),
      );

      installResult = verifyFilesByCount(instPath, packageItem.info.files);
    } else {
      installResult = await install(
        unzippedPath,
        instPath,
        packageItem.info.files,
      );
    }
  } catch (e) {
    log.error(e);
    installResult = false;
  }

  if (installResult) {
    // isContinuous のパッケージはインストール日をバージョンとして記録する
    const latestVersion = packageItem.info.isContinuous
      ? getDate()
      : packageItem.info.latestVersion;
    const apmJson = await ApmJson.load(instPath);
    await apmJson.addPackage(packageItem.id, latestVersion);
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
 * @param {BrowserWindow} win - A browser window used for downloads and dialogs.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @param {Pick<PackageState, 'id' | 'info'>} packageItem - The package to install.
 * @param {object} [options] - Options.
 * @param {boolean} [options.direct] - Install from the direct link to the zip.
 * @param {string} [options.archivePath] - Path to the already-downloaded archive.
 * @returns {Promise<InstallPackageResult>} The result status.
 */
export async function installPackageFlow(
  win: BrowserWindow,
  config: Config,
  instPath: string,
  packageItem: Pick<PackageState, 'id' | 'info'>,
  { direct = false, archivePath }: { direct?: boolean; archivePath?: string },
): Promise<InstallPackageResult> {
  return await runInstallFlow<
    'downloadFailed' | 'canceled' | 'redownloadFailed'
  >(win, {
    resolveArchive: async () => {
      if (archivePath) return { archivePath };
      if (direct) {
        const resolvedArchivePath = await downloadFile(
          win,
          packageItem.info.directURL,
          { loadCache: true, subDir: 'package' },
        );
        if (!resolvedArchivePath) {
          log.error('Failed downloading a file.');
          return { failure: 'downloadFailed' as const };
        }
        return { archivePath: resolvedArchivePath };
      }
      const downloadResult = await openBrowser(
        win,
        packageItem.info.downloadURLs[0],
        'package',
      );
      if (!downloadResult) {
        log.info('The installation was canceled.');
        return { failure: 'canceled' as const };
      }
      return { archivePath: downloadResult.savePath };
    },
    // integrity があるなら取得経路(直リンク・手動 DL・archivePath 渡し)に
    // よらず検証する。無いパッケージ(公式データの約 1/4)を弾かないのは、
    // 検証必須化すると既存パッケージのインストールが広く壊れるため
    integrity: packageItem.info.releases?.find(
      (r) => r.version === packageItem.info.latestVersion,
    )?.integrity?.archive,
    corruptLogUrl: packageItem.info.directURL,
    redownloadArchive: async () => {
      if (direct) {
        // 再ダウンロード先が subDir 'core' なのは旧実装のままの挙動
        const resolvedArchivePath = await downloadFile(
          win,
          packageItem.info.directURL,
          { subDir: 'core' },
        );
        if (!resolvedArchivePath) {
          log.error(
            `Failed downloading the archive file. URL:${packageItem.info.directURL}`,
          );
          return { failure: 'redownloadFailed' as const };
        }
        return { archivePath: resolvedArchivePath };
      }
      // 手動 DL・archivePath 渡しの経路はブラウザ窓での再取得になる
      const redownloadResult = await openBrowser(
        win,
        packageItem.info.downloadURLs[0],
        'package',
      );
      if (!redownloadResult) {
        log.info('The installation was canceled.');
        return { failure: 'canceled' as const };
      }
      return { archivePath: redownloadResult.savePath };
    },
    install: (resolvedArchivePath) =>
      installPackageArchive(instPath, resolvedArchivePath, packageItem),
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
