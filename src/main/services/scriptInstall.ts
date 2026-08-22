import type { Packages, Scripts } from 'apm-schema';
import type { BrowserWindow } from 'electron';
import log from 'electron-log/main';
import {
  copy,
  existsSync,
  readdir as fsReaddir,
  mkdir,
  readJson,
  rename,
  rm,
  writeJson,
} from 'fs-extra';
import * as matcher from 'matcher';
import path from 'node:path';
import { resolveInside } from '../../shared/apmPath';
import { asyncFlatMap } from '../../shared/asyncFlatMap';
import { getHash } from '../../shared/getHash';
import { convertV1PackageIds } from '../../shared/packageId';
import unzip from '../../shared/unzip';
import ApmJson from '../ApmJson';
import type Config from '../Config';
import { openBrowser } from './browser';
import { downloadFile } from './download';
import { getInfo, getScriptsDataUrl } from './modList';
import {
  getDate,
  installPackageFlow,
  type InstallPackageResult,
} from './packageInstall';
import { getIdDict, getPackagesWithStatus } from './packageList';

/**
 * Returns an object parsed from scripts.json.
 * 旧 src/renderer/main/package.ts の getScriptsList と同一の挙動。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {boolean} update - Download the json file.
 * @returns {Promise<{webpage: Scripts['webpage']; scripts: Scripts['scripts']}>} An object parsed from scripts.json.
 */
export async function getScriptsList(
  win: BrowserWindow,
  config: Config,
  update: boolean,
) {
  const dictUrl = await getScriptsDataUrl(win, config);
  const result: { webpage: Scripts['webpage']; scripts: Scripts['scripts'] } = {
    webpage: [],
    scripts: [],
  };

  for (const url of dictUrl) {
    const scriptsJson = await downloadFile(win, url, {
      loadCache: !update,
      subDir: 'package',
      keyText: url,
    });
    if (!scriptsJson) continue;
    const json: Scripts = await readJson(scriptsJson);
    result.webpage = result.webpage.concat(json.webpage);
    result.scripts = result.scripts.concat(json.scripts);
  }

  if (update) {
    const currentMod = await getInfo(win, config);
    config.modDate.setScripts(
      Math.max(
        ...currentMod.scripts.map((p) => new Date(p.modified).getTime()),
      ),
    );
  }

  return result;
}

// To avoid a bug in the library
// https://github.com/sindresorhus/matcher/issues/32
const isMatch = (
  input: string | readonly string[],
  pattern: readonly string[],
) => pattern.some((p) => matcher.isMatch(input, p));

export type InstallScriptResult =
  'success' | 'noScript' | 'containsPlugin' | 'installFailed';

/**
 * Unzips the downloaded script archive, verifies and copies the script files,
 * and records the generated package in the local packages.json and apm.json.
 * 旧 src/renderer/main/package.ts の installScript 後半
 * (展開 → スクリプト有無の検証 → 配置 → パッケージ情報の生成と保存)と
 * 同一の挙動。ローカル packages.json への追記は旧 parseJson.addPackage 相当
 * (データ v1 互換の ID 変換込み)。
 * @param {BrowserWindow} win - A browser window used for the download session.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @param {string} archivePath - Path to the downloaded archive.
 * @param {string} url - The URL of the script distribution page.
 * @param {object} matchInfo - The matched script information.
 * @param {string} matchInfo.folder - A folder name to copy the scripts into.
 * @param {string} [matchInfo.developer] - The developer of the script.
 * @param {string[]} [matchInfo.dependencies] - Dependencies of the script.
 * @returns {Promise<InstallScriptResult>} The result of the installation.
 */
export async function installScriptArchive(
  win: BrowserWindow,
  config: Config,
  instPath: string,
  archivePath: string,
  url: string,
  matchInfo: { folder: string; developer?: string; dependencies?: string[] },
): Promise<InstallScriptResult> {
  const pluginExtRegex = /\.(auf|aui|auo|auc|aul)$/;
  const scriptExtRegex = /\.(anm|obj|cam|tra|scn)$/;

  const searchScriptRoot = async (dirName: string): Promise<string[]> => {
    const dirents = await fsReaddir(dirName, {
      withFileTypes: true,
    });
    return dirents.find((i) => i.isFile() && scriptExtRegex.test(i.name))
      ? [dirName]
      : await asyncFlatMap(
          dirents.filter((i) => i.isDirectory()),
          (i) => searchScriptRoot(path.join(dirName, i.name)),
        );
  };

  const extExists = async (
    dirName: string,
    regex: RegExp,
  ): Promise<boolean> => {
    const dirents = await fsReaddir(dirName, {
      withFileTypes: true,
    });
    return dirents.filter((i) => i.isFile() && regex.test(i.name)).length > 0
      ? true
      : (
          await asyncFlatMap(
            dirents.filter((i) => i.isDirectory()),
            (i) => extExists(path.join(dirName, i.name), regex),
          )
        ).some((e) => e);
  };

  try {
    const getUnzippedPath = async () => {
      if (['.zip', '.lzh', '.7z', '.rar'].includes(path.extname(archivePath))) {
        return await unzip(archivePath);
      } else {
        // In this line, path.dirname(archivePath) always refers to the 'Data/package' folder.
        const newFolder = path.join(
          path.dirname(archivePath),
          'tmp_' + path.basename(archivePath),
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

    if (!(await extExists(unzippedPath, scriptExtRegex))) {
      log.error('No script files are included.');
      return 'noScript';
    }
    if (await extExists(unzippedPath, pluginExtRegex)) {
      log.error('Plugin files are included.');
      return 'containsPlugin';
    }

    // Copying files
    const denyList = [
      '*readme*',
      '*copyright*',
      '*.txt',
      '*.zip',
      '*.aup',
      '*.md',
      'doc',
      'old',
      'old_*',
    ];
    const scriptRoot = (await searchScriptRoot(unzippedPath))[0];
    // folder は scripts.json(リモート)由来。インストール先の外に出る指定を
    // 書き込み前に弾く
    const scriptFolder = resolveInside(instPath, 'script', matchInfo.folder);
    const entriesToCopy = (
      await fsReaddir(scriptRoot, {
        withFileTypes: true,
      })
    )
      .filter((p) => !isMatch([p.name], denyList))
      .map((p) => {
        return {
          src: path.join(scriptRoot, p.name),
          dest: resolveInside(scriptFolder, p.name),
          filename: path
            .join('script', matchInfo.folder, p.name)
            .replaceAll('\\', '/'),
          isDirectory: p.isDirectory(),
        };
      });
    await mkdir(scriptFolder, {
      recursive: true,
    });
    await Promise.all(
      entriesToCopy.map((filePath) => copy(filePath.src, filePath.dest)),
    );

    // Constructing package information
    const files = entriesToCopy.map((i) => {
      return { filename: i.filename, isDirectory: i.isDirectory };
    });

    const filteredFiles = files.filter((f) => scriptExtRegex.test(f.filename));
    const name = path.basename(
      filteredFiles[0].filename,
      path.extname(filteredFiles[0].filename),
    );
    const id = 'script_' + getHash(name);

    // Rename the extracted folder
    const newPath = path.join(path.dirname(unzippedPath), id);
    if (existsSync(newPath)) await rm(newPath, { recursive: true });
    await rename(unzippedPath, newPath);

    // Save package information
    const packageItem = {
      id: id,
      name: name,
      overview: 'スクリプト',
      description:
        'スクリプト一覧: ' +
        filteredFiles.map((f) => path.basename(f.filename)).join(', '),
      developer: matchInfo?.developer ?? '-',
      dependencies: matchInfo?.dependencies,
      pageURL: url,
      downloadURLs: [url] as [string, ...string[]],
      latestVersion: getDate(),
      files: files,
    };

    // 旧 parseJson.addPackage と同一の挙動(既存一覧の ID 変換込み)
    const localPackagesPath = path.join(instPath, 'packages.json');
    const localPackages: Packages['packages'] = existsSync(localPackagesPath)
      ? ((await readJson(localPackagesPath)) as Packages).packages
      : [];
    convertV1PackageIds(localPackages, await getIdDict(win, config));
    const newLocalPackages = localPackages.filter((p) => p.id !== id);
    newLocalPackages.push(packageItem as Packages['packages'][number]);
    await writeJson(localPackagesPath, {
      version: 3,
      packages: newLocalPackages,
    });

    const apmJson = await ApmJson.load(instPath);
    await apmJson.addPackage(packageItem.id, packageItem.latestVersion);
    return 'success';
  } catch (e) {
    log.error(e);
    return 'installFailed';
  }
}

export type InstallScriptFlowResult =
  | { route: 'flow'; status: 'canceled' | 'notSupported' | 'redirectNotFound' }
  | { route: 'script'; status: InstallScriptResult }
  | { route: 'redirect'; status: InstallPackageResult };

/**
 * Opens the script distribution site in the browser, resolves the matched
 * script (or its redirect package) from the download history, and installs it.
 * 旧 src/renderer/main/package.ts の installScript 前半(ブラウザ DL →
 * matchInfo 解決 → redirect 分岐)と同一の挙動。UI は renderer 側に残る。
 * @param {BrowserWindow} win - A browser window used for downloads and dialogs.
 * @param {Config} config - The config instance.
 * @param {string} instPath - An installation path.
 * @param {string} url - The URL of the script distribution site.
 * @returns {Promise<InstallScriptFlowResult>} The result status with its route.
 */
export async function installScriptFlow(
  win: BrowserWindow,
  config: Config,
  instPath: string,
  url: string,
): Promise<InstallScriptFlowResult> {
  const downloadResult = await openBrowser(win, url, 'package');
  if (!downloadResult) {
    log.info('The installation was canceled.');
    return { route: 'flow', status: 'canceled' };
  }

  const archivePath = downloadResult.savePath;
  const history = downloadResult.history;
  const matchInfo = [...(await getScriptsList(win, config, false)).scripts]
    .reverse()
    .find((item) => isMatch(history, item.match));

  if (!matchInfo) {
    log.error('The script is not supported.');
    return { route: 'flow', status: 'notSupported' };
  }

  if ('redirect' in matchInfo) {
    // Determine which of the redirections can be installed and install them.
    const packages = (await getPackagesWithStatus(win, config, instPath, false))
      .packages;
    const packageId = matchInfo.redirect
      .split('|')
      .find((candidate: string) =>
        packages.find((p) => p.id === candidate && p.doNotInstall !== true),
      );
    if (!packageId) {
      return { route: 'flow', status: 'redirectNotFound' };
    }
    const packageToInstall = packages.find((p) => p.id === packageId);
    return {
      route: 'redirect',
      status: await installPackageFlow(
        win,
        config,
        instPath,
        packageToInstall,
        {
          archivePath,
        },
      ),
    };
  }

  return {
    route: 'script',
    status: await installScriptArchive(
      win,
      config,
      instPath,
      archivePath,
      url,
      {
        folder: matchInfo.folder,
        developer: matchInfo.developer,
        dependencies: matchInfo.dependencies,
      },
    ),
  };
}
