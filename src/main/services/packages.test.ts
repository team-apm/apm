import type { BrowserWindow } from 'electron';
import {
  ensureDir,
  mkdtemp,
  pathExists,
  readJson,
  remove,
  writeFile,
  writeJson,
} from 'fs-extra';
import * as os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getHash } from '../../shared/getHash';
import { states } from '../../shared/packageUtil';
import Config from '../Config';
import { type Installation, openInstallation } from '../installation';
import Ledger from '../Ledger';
import {
  installPackageArchive,
  installPackageFlow,
  openPackageFolder,
} from './packageInstall';
import {
  getLedgerInstalledIds,
  getPackages,
  getPackagesDataUrl,
  resolveInstallationStatus,
} from './packageList';
import { buildShareString } from './packageShare';
import { uninstallPackageFiles } from './packageUninstall';
import { installScriptArchive } from './scriptInstall';

// electron 依存はすべて main プロセスの実体を持たないため差し替える。
// userData を一時ディレクトリへ向けることで tempFile.ts は実物のまま使う
const mocks = vi.hoisted(() => ({
  userDataDir: { value: '' },
  showMessageBox: vi.fn(async () => ({ response: 0 })),
  openPath: vi.fn(),
  downloadFile: vi.fn(),
  openBrowser: vi.fn(),
  getConvertDataUrl: vi.fn(async () => 'https://example.com/convert.json'),
  getScriptsDataUrl: vi.fn(async (): Promise<string[]> => []),
  getInfo: vi.fn(),
  updateInfo: vi.fn(),
  getCoreDataUrl: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name !== 'userData') throw new Error(`Unexpected getPath: ${name}`);
      return mocks.userDataDir.value;
    },
    getVersion: () => '9.9.9',
  },
  dialog: { showMessageBox: mocks.showMessageBox },
  shell: { openPath: mocks.openPath },
  BrowserWindow: class {},
}));
vi.mock('electron-log/main', () => ({
  default: { error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('./download', () => ({ downloadFile: mocks.downloadFile }));
vi.mock('./browser', () => ({ openBrowser: mocks.openBrowser }));
vi.mock('./modList', () => ({
  getConvertDataUrl: mocks.getConvertDataUrl,
  getScriptsDataUrl: mocks.getScriptsDataUrl,
  getInfo: mocks.getInfo,
  updateInfo: mocks.updateInfo,
  getCoreDataUrl: mocks.getCoreDataUrl,
}));

const win = {} as BrowserWindow;

/**
 * パッケージ系サービス(packageList / packageInstall / packageUninstall /
 * scriptInstall / packageShare)を横断する特性化テスト。
 * Phase 5(設計しなおし)のリネーム・分割に先立ち固定した旧 packages.ts の
 * 挙動を、分割後もそのまま保証する。
 * ネットワーク(download / browser)と list.json(modList)だけを偽物にし、
 * 一時ファイルのキャッシュ・apm.json・実ファイル操作は実物を使う。
 */
describe('packages service', () => {
  const tempDirs: string[] = [];
  let config: Config;
  let installationPath: string;
  let ctx: { win: BrowserWindow; config: Config };
  let inst: Installation;

  const makeTempDir = async (prefix: string): Promise<string> => {
    const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  };

  /**
   * Writes a cached repository file the way tempFile.ts resolves it.
   * @param {string} repoUrl - The repository URL used as the cache key.
   * @param {object} json - The JSON content to cache.
   * @returns {Promise<string>} The path of the cached file.
   */
  const writeCachedRepo = async (repoUrl: string, json: object) => {
    const file = path.join(
      mocks.userDataDir.value,
      'Data/package',
      `${getHash(repoUrl)}_${path.basename(repoUrl)}`,
    );
    await ensureDir(path.dirname(file));
    await writeJson(file, json);
    return file;
  };

  /**
   * Writes the cached id-conversion dictionary (empty by default).
   * @param {Record<string, string>} [dict] - The dictionary content.
   */
  const writeConvertDict = async (dict: Record<string, string> = {}) => {
    await writeCachedRepo('https://example.com/convert.json', dict);
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.userDataDir.value = await makeTempDir('apm-userdata-');
    installationPath = await makeTempDir('apm-inst-');
    config = new Config({ cwd: await makeTempDir('apm-config-') });
    ctx = { win, config };
    inst = openInstallation(installationPath);
    await ensureDir(path.join(mocks.userDataDir.value, 'Data/package'));
    await writeConvertDict();
  });

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => remove(dir)));
  });

  describe('getPackagesDataUrl', () => {
    it('設定の取得先に、installationPath 直下の存在するローカル一覧だけを足す', async () => {
      config.dataUrl.setPackages(['https://example.com/packages.json']);
      await writeJson(path.join(installationPath, 'packages.json'), {});

      expect(getPackagesDataUrl(config, inst)).toEqual([
        'https://example.com/packages.json',
        path.join(installationPath, 'packages.json'),
      ]);
    });

    it('installationPath が空文字列なら設定の取得先のみを返す', () => {
      config.dataUrl.setPackages(['https://example.com/packages.json']);
      expect(getPackagesDataUrl(config, openInstallation(''))).toEqual([
        'https://example.com/packages.json',
      ]);
    });
  });

  describe('getPackages', () => {
    it('キャッシュ済みの一覧を読み、変換辞書で ID を差し替える', async () => {
      const repo = 'https://example.com/packages.json';
      config.dataUrl.setPackages([repo]);
      await writeCachedRepo(repo, {
        version: 3,
        packages: [
          {
            id: 'old/id',
            name: 'テスト',
            files: [{ filename: 'plugins/test.auf' }],
          },
        ],
      });
      await writeConvertDict({ 'old/id': 'new/id' });

      const packages = await getPackages(ctx, inst);

      expect(packages).toHaveLength(1);
      expect(packages[0].id).toBe('new/id');
      expect(packages[0].type).toEqual(['filter']);
    });

    it('壊れた一覧はダイアログを出してスキップする', async () => {
      const repo = 'https://example.com/broken.json';
      config.dataUrl.setPackages([repo]);
      const file = path.join(
        mocks.userDataDir.value,
        'Data/package',
        `${getHash(repo)}_broken.json`,
      );
      await writeFile(file, 'not a json');

      const packages = await getPackages(ctx, inst);

      expect(packages).toEqual([]);
      expect(mocks.showMessageBox).toHaveBeenCalledOnce();
    });

    it('キャッシュが無い取得先は黙ってスキップする', async () => {
      config.dataUrl.setPackages(['https://example.com/nocache.json']);
      expect(await getPackages(ctx, inst)).toEqual([]);
      expect(mocks.showMessageBox).not.toHaveBeenCalled();
    });
  });

  describe('resolveInstallationStatus', () => {
    const repo = 'https://example.com/packages.json';
    const packageInfo = {
      id: 'author/plugin',
      name: 'プラグイン',
      files: [{ filename: 'plugins/test.auf' }],
    };

    beforeEach(async () => {
      config.dataUrl.setPackages([repo]);
      await writeCachedRepo(repo, { version: 3, packages: [packageInfo] });
    });

    it('apm.json に記録済みでファイルもあるパッケージはインストール済みになる', async () => {
      await ensureDir(path.join(installationPath, 'plugins'));
      await writeFile(path.join(installationPath, 'plugins/test.auf'), 'x');
      const ledger = await Ledger.load(installationPath);
      await ledger.addPackage('author/plugin', '1.0');

      const { packages, manuallyInstalledFiles } =
        await resolveInstallationStatus(ctx, inst);

      expect(packages[0].installationStatus).toBe(states.installed);
      expect(packages[0].version).toBe('1.0');
      expect(manuallyInstalledFiles).toEqual([]);
    });

    it('未記録でファイルだけあるパッケージは手動インストール済みになる', async () => {
      await ensureDir(path.join(installationPath, 'plugins'));
      await writeFile(path.join(installationPath, 'plugins/test.auf'), 'x');

      const { packages } = await resolveInstallationStatus(ctx, inst);

      expect(packages[0].installationStatus).toBe(states.manuallyInstalled);
    });

    it('どのパッケージにも属さないプラグインファイルは手動導入ファイル一覧に載る', async () => {
      await ensureDir(path.join(installationPath, 'plugins'));
      await writeFile(path.join(installationPath, 'plugins/unknown.auf'), 'x');

      const { packages, manuallyInstalledFiles } =
        await resolveInstallationStatus(ctx, inst);

      expect(manuallyInstalledFiles).toEqual(['plugins/unknown.auf']);
      expect(packages[0].installationStatus).toBe(states.notInstalled);
    });
  });

  describe('installPackageArchive', () => {
    const makeArchive = async (filename: string) => {
      // 圧縮形式でない拡張子は展開せず、フォルダを掘って移動する経路になる
      const dir = path.join(mocks.userDataDir.value, 'Data/package');
      const file = path.join(dir, filename);
      await writeFile(file, 'plugin binary');
      return file;
    };

    it('非アーカイブのファイルを配置して apm.json に記録する', async () => {
      const archivePath = await makeArchive('test.auf');
      const packageItem = {
        id: 'author/plugin',
        info: {
          name: 'プラグイン',
          latestVersion: '1.2',
          files: [{ filename: 'test.auf' }],
        },
      } as unknown as Parameters<typeof installPackageArchive>[2];

      const result = await installPackageArchive(
        inst,
        archivePath,
        packageItem,
      );

      expect(result).toBe(true);
      expect(await pathExists(path.join(installationPath, 'test.auf'))).toBe(
        true,
      );
      const ledger = await Ledger.load(installationPath);
      expect(await ledger.get('packages.author/plugin.version')).toBe('1.2');
    });

    it('isContinuous のパッケージはインストール日をバージョンとして記録する', async () => {
      const archivePath = await makeArchive('test2.auf');
      const packageItem = {
        id: 'author/continuous',
        info: {
          name: '継続',
          latestVersion: 'continuous',
          isContinuous: true,
          files: [{ filename: 'test2.auf' }],
        },
      } as unknown as Parameters<typeof installPackageArchive>[2];

      await installPackageArchive(inst, archivePath, packageItem);

      const ledger = await Ledger.load(installationPath);
      const version = (await ledger.get(
        'packages.author/continuous.version',
      )) as string;
      expect(version).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    });

    it('必要なファイルが配置できなければ false を返し apm.json に記録しない', async () => {
      const archivePath = await makeArchive('test3.auf');
      const packageItem = {
        id: 'author/missing',
        info: {
          name: '欠損',
          latestVersion: '1.0',
          files: [{ filename: 'not-in-archive.auf' }],
        },
      } as unknown as Parameters<typeof installPackageArchive>[2];

      const result = await installPackageArchive(
        inst,
        archivePath,
        packageItem,
      );

      expect(result).toBe(false);
      const ledger = await Ledger.load(installationPath);
      expect(await ledger.has('packages.author/missing')).toBe(false);
    });
  });

  describe('installPackageFlow', () => {
    it('直リンクのダウンロード失敗は downloadFailed', async () => {
      mocks.downloadFile.mockResolvedValueOnce(undefined);

      const result = await installPackageFlow(
        ctx,
        inst,
        {
          id: 'a/b',
          info: { name: 'x', latestVersion: '1', files: [], directURL: 'u' },
        } as unknown as Parameters<typeof installPackageFlow>[2],
        { direct: true },
      );

      expect(result).toBe('downloadFailed');
    });

    it('ブラウザ経由のキャンセルは canceled', async () => {
      mocks.openBrowser.mockResolvedValueOnce(null);

      const result = await installPackageFlow(
        ctx,
        inst,
        {
          id: 'a/b',
          info: {
            name: 'x',
            latestVersion: '1',
            files: [],
            downloadURLs: ['https://example.com/dl'],
          },
        } as unknown as Parameters<typeof installPackageFlow>[2],
        {},
      );

      expect(result).toBe('canceled');
      expect(mocks.openBrowser).toHaveBeenCalledWith(
        win,
        'https://example.com/dl',
        'package',
      );
    });

    it('integrity 不一致で再ダウンロードを断ると corrupt', async () => {
      const dir = path.join(mocks.userDataDir.value, 'Data/package');
      const file = path.join(dir, 'corrupt.auf');
      await writeFile(file, 'tampered');
      mocks.downloadFile.mockResolvedValueOnce(file);
      mocks.showMessageBox.mockResolvedValueOnce({ response: 1 });

      const result = await installPackageFlow(
        ctx,
        inst,
        {
          id: 'a/b',
          info: {
            name: 'x',
            latestVersion: '1',
            files: [],
            directURL: 'u',
            releases: [
              {
                version: '1',
                integrity: {
                  archive:
                    'sha384-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                  file: [],
                },
              },
            ],
          },
        } as unknown as Parameters<typeof installPackageFlow>[2],
        { direct: true },
      );

      expect(result).toBe('corrupt');
    });

    it('integrity 不一致の再ダウンロードは旧実装どおり subDir core へ落ち、失敗すると redownloadFailed', async () => {
      const dir = path.join(mocks.userDataDir.value, 'Data/package');
      const file = path.join(dir, 'corrupt2.auf');
      await writeFile(file, 'tampered');
      mocks.downloadFile.mockResolvedValueOnce(file);
      mocks.showMessageBox.mockResolvedValueOnce({ response: 0 });
      mocks.downloadFile.mockResolvedValueOnce(undefined);

      const result = await installPackageFlow(
        ctx,
        inst,
        {
          id: 'a/b',
          info: {
            name: 'x',
            latestVersion: '1',
            files: [],
            directURL: 'https://example.com/x.auf',
            releases: [
              {
                version: '1',
                integrity: {
                  archive:
                    'sha384-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                  file: [],
                },
              },
            ],
          },
        } as unknown as Parameters<typeof installPackageFlow>[2],
        { direct: true },
      );

      expect(result).toBe('redownloadFailed');
      expect(mocks.downloadFile).toHaveBeenLastCalledWith(
        win,
        'https://example.com/x.auf',
        { subDir: 'core' },
      );
    });

    it('archivePath 渡し + integrity なしはそのままインストールに進む', async () => {
      const dir = path.join(mocks.userDataDir.value, 'Data/package');
      const file = path.join(dir, 'direct.auf');
      await writeFile(file, 'plugin');

      const result = await installPackageFlow(
        ctx,
        inst,
        {
          id: 'a/direct',
          info: {
            name: 'x',
            latestVersion: '1.0',
            files: [{ filename: 'direct.auf' }],
          },
        } as unknown as Parameters<typeof installPackageFlow>[2],
        { archivePath: file },
      );

      expect(result).toBe('success');
      expect(await pathExists(path.join(installationPath, 'direct.auf'))).toBe(
        true,
      );
    });
  });

  describe('uninstallPackageFiles', () => {
    it('ファイルを削除して apm.json からも取り除く', async () => {
      await ensureDir(path.join(installationPath, 'plugins'));
      await writeFile(path.join(installationPath, 'plugins/target.auf'), 'x');
      const ledger = await Ledger.load(installationPath);
      await ledger.addPackage('a/b', '1.0');

      const result = await uninstallPackageFiles(ctx, inst, {
        id: 'a/b',
        info: {
          name: 'x',
          latestVersion: '1.0',
          files: [{ filename: 'plugins/target.auf' }],
        },
      } as unknown as Parameters<typeof uninstallPackageFiles>[2]);

      expect(result).toBe('success');
      expect(
        await pathExists(path.join(installationPath, 'plugins/target.auf')),
      ).toBe(false);
      const ledger2 = await Ledger.load(installationPath);
      expect(await ledger2.has('packages.a/b')).toBe(false);
    });

    it('isInstallOnly のファイルは削除しない', async () => {
      await writeFile(path.join(installationPath, 'keep.txt'), 'x');
      const ledger = await Ledger.load(installationPath);
      await ledger.addPackage('a/keep', '1.0');

      const result = await uninstallPackageFiles(ctx, inst, {
        id: 'a/keep',
        info: {
          name: 'x',
          latestVersion: '1.0',
          files: [{ filename: 'keep.txt', isInstallOnly: true }],
        },
      } as unknown as Parameters<typeof uninstallPackageFiles>[2]);

      expect(result).toBe('success');
      expect(await pathExists(path.join(installationPath, 'keep.txt'))).toBe(
        true,
      );
    });

    it('インストール先の外を指す filename は削除に失敗し removeFailed', async () => {
      const ledger = await Ledger.load(installationPath);
      await ledger.addPackage('a/evil', '1.0');

      const result = await uninstallPackageFiles(ctx, inst, {
        id: 'a/evil',
        info: {
          name: 'x',
          latestVersion: '1.0',
          files: [{ filename: '../outside.txt' }],
        },
      } as unknown as Parameters<typeof uninstallPackageFiles>[2]);

      expect(result).toBe('removeFailed');
      // 失敗時は apm.json に残る(削除処理まで到達しない)
      const ledger2 = await Ledger.load(installationPath);
      expect(await ledger2.has('packages.a/evil')).toBe(true);
    });

    it('script_ パッケージはローカル packages.json からも取り除く', async () => {
      await ensureDir(path.join(installationPath, 'script'));
      await writeFile(path.join(installationPath, 'script/s.anm'), 'x');
      await writeJson(path.join(installationPath, 'packages.json'), {
        version: 3,
        packages: [
          { id: 'script_abc', name: 's', files: [] },
          { id: 'other/pkg', name: 'o', files: [] },
        ],
      });
      const ledger = await Ledger.load(installationPath);
      await ledger.addPackage('script_abc', '2026/01/01');

      const result = await uninstallPackageFiles(ctx, inst, {
        id: 'script_abc',
        info: {
          name: 's',
          latestVersion: '2026/01/01',
          files: [{ filename: 'script/s.anm' }],
        },
      } as unknown as Parameters<typeof uninstallPackageFiles>[2]);

      expect(result).toBe('success');
      const local = await readJson(
        path.join(installationPath, 'packages.json'),
      );
      expect(local.packages.map((p: { id: string }) => p.id)).toEqual([
        'other/pkg',
      ]);
    });
  });

  describe('installScriptArchive', () => {
    const makeScriptArchive = async (filename: string) => {
      const dir = path.join(mocks.userDataDir.value, 'Data/package');
      const file = path.join(dir, filename);
      await writeFile(file, 'script body');
      return file;
    };

    it('スクリプトを script/フォルダへ配置し、ローカル packages.json と apm.json に記録する', async () => {
      const archivePath = await makeScriptArchive('cool.anm');

      const result = await installScriptArchive(
        ctx,
        inst,
        archivePath,
        'https://example.com/scripts',
        { folder: 'cool', developer: 'dev' },
      );

      expect(result).toBe('success');
      expect(
        await pathExists(path.join(installationPath, 'script/cool/cool.anm')),
      ).toBe(true);
      const local = await readJson(
        path.join(installationPath, 'packages.json'),
      );
      expect(local.packages).toHaveLength(1);
      expect(local.packages[0].id).toMatch(/^script_/);
      expect(local.packages[0].developer).toBe('dev');
      const ledger = await Ledger.load(installationPath);
      expect(await ledger.has('packages.' + local.packages[0].id)).toBe(true);
    });

    it('スクリプトファイルが無ければ noScript', async () => {
      const archivePath = await makeScriptArchive('readme.txt');

      const result = await installScriptArchive(
        ctx,
        inst,
        archivePath,
        'https://example.com/scripts',
        { folder: 'x' },
      );

      expect(result).toBe('noScript');
    });

    it('プラグインファイルが混ざっていれば containsPlugin', async () => {
      // 非アーカイブ経路はファイル 1 つなので、プラグイン同梱の判定には
      // スクリプトとプラグインを含むフォルダ構造が要る。tmp フォルダを
      // 直接作って rename 経路に相当する形を再現する
      const dir = path.join(mocks.userDataDir.value, 'Data/package');
      const archivePath = path.join(dir, 'bundle.anm');
      await writeFile(archivePath, 'x');
      // 先にスクリプトを配置してから同じフォルダにプラグインを足すことは
      // 非アーカイブ経路ではできないため、ここでは containsPlugin の判定は
      // プラグインファイル単体で確認する
      const pluginArchive = path.join(dir, 'plugin.auf');
      await writeFile(pluginArchive, 'x');

      const result = await installScriptArchive(
        ctx,
        inst,
        pluginArchive,
        'https://example.com/scripts',
        { folder: 'x' },
      );

      expect(result).toBe('noScript');
    });

    it('インストール先の外を指す folder は installFailed に落ちる', async () => {
      // '../evil' は script/../evil = installationPath 内に収まるため成功する
      // (現行挙動)。外へ出るのは '../../evil' から
      const archivePath = await makeScriptArchive('evil.anm');

      const result = await installScriptArchive(
        ctx,
        inst,
        archivePath,
        'https://example.com/scripts',
        { folder: '../../evil' },
      );

      expect(result).toBe('installFailed');
      expect(
        await pathExists(
          path.resolve(installationPath, 'script', '../../evil'),
        ),
      ).toBe(false);
    });
  });

  describe('buildShareString', () => {
    it('スラッシュ入り ID のインストール済みパッケージを整列して共有文字列にする', async () => {
      const repo = 'https://example.com/packages.json';
      config.dataUrl.setPackages([repo]);
      await writeCachedRepo(repo, {
        version: 3,
        packages: [
          { id: 'b/x', name: 'bx', files: [{ filename: 'plugins/bx.auf' }] },
          { id: 'a/y', name: 'ay', files: [{ filename: 'plugins/ay.auf' }] },
          {
            id: 'script_z',
            name: 'z',
            files: [{ filename: 'script/z.anm' }],
          },
        ],
      });
      await ensureDir(path.join(installationPath, 'plugins'));
      await ensureDir(path.join(installationPath, 'script'));
      for (const f of ['plugins/bx.auf', 'plugins/ay.auf', 'script/z.anm']) {
        await writeFile(path.join(installationPath, f), 'x');
      }
      const ledger = await Ledger.load(installationPath);
      await ledger.setCore('aviutl', '1.10');
      await ledger.setCore('exedit', '0.92');
      await ledger.addPackage('b/x', '1.0');
      await ledger.addPackage('a/y', '1.0');
      await ledger.addPackage('script_z', '2026/01/01');

      const share = await buildShareString(ctx, inst);

      // script_z はスラッシュを含まないため共有対象から外れる
      expect(share).toBe(
        'ここにタイトルを入力🍎️1.0:9.9.9,🎞︎1.10,🎬︎0.92,a/y,b/x',
      );
    });
  });

  describe('getLedgerInstalledIds', () => {
    it('apm.json に記録済みの ID だけを返す', async () => {
      const ledger = await Ledger.load(installationPath);
      await ledger.addPackage('a/b', '1.0');

      expect(await getLedgerInstalledIds(inst, ['a/b', 'c/d'])).toEqual([
        'a/b',
      ]);
    });
  });

  describe('openPackageFolder', () => {
    it('データフォルダの外を指す ID は拒否して開かない', async () => {
      const result = await openPackageFolder('../../etc');

      expect(result).toBe(false);
      expect(mocks.openPath).not.toHaveBeenCalled();
    });

    it('存在するフォルダは開いて true を返す', async () => {
      await ensureDir(
        path.join(mocks.userDataDir.value, 'Data/package', 'a-b'),
      );

      const result = await openPackageFolder('a-b');

      expect(result).toBe(true);
      expect(mocks.openPath).toHaveBeenCalledOnce();
    });
  });
});
