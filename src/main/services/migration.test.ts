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
import Config from '../Config';
import { type Installation, openInstallation } from '../installation';
import { migrationByFolder, migrationGlobal } from './migration';

const OLD_DEFAULT_DATA_URL =
  'https://cdn.jsdelivr.net/gh/team-apm/apm-data@main/data/';

const mocks = vi.hoisted(() => ({
  userDataDir: { value: '' },
  // 引数の型を書くのは、案内文言のアサーションで mock.calls[0][0] を
  // 読むため(引数なしで宣言すると calls が空タプルになる)
  showMessageBox: vi.fn<
    (options: {
      message: string;
      type: string;
    }) => Promise<{ response: number }>
  >(async () => ({ response: 0 })),
  downloadFile: vi.fn(async () => '/backup/copy'),
}));

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name !== 'userData') throw new Error(`Unexpected getPath: ${name}`);
      return mocks.userDataDir.value;
    },
  },
  dialog: { showMessageBox: mocks.showMessageBox },
  BrowserWindow: class {},
}));
vi.mock('electron-log/main', () => ({
  default: { error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('./download', () => ({ downloadFile: mocks.downloadFile }));

const win = {} as BrowserWindow;

/**
 * migration サービスのテスト。
 * 契約は「入力の版(v1 = dataVersion キー無し / v2)が何であれ、出力は v3 の
 * 正規形」。段(1→2→3)は踏まないので、中間状態ではなく最終状態を固定する。
 */
describe('migration service', () => {
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

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.userDataDir.value = await makeTempDir('apm-userdata-');
    installationPath = await makeTempDir('apm-inst-');
    config = new Config({ cwd: await makeTempDir('apm-config-') });
    ctx = { win, config };
    inst = openInstallation(installationPath);
    // v1 のキャッシュ掃除が readdir する Data/package を用意しておく
    await ensureDir(path.join(mocks.userDataDir.value, 'Data/package'));
  });

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => remove(dir)));
  });

  describe('migrationGlobal', () => {
    it('初回起動(main 未設定)は dataVersion 3 を書いて終わる', async () => {
      await migrationGlobal(ctx);

      expect(config.getDataVersion()).toBe('3');
      expect(mocks.showMessageBox).not.toHaveBeenCalled();
    });

    it('dataVersion 3 済みなら何もしない', async () => {
      config.dataUrl.setMain('https://example.com/v3/');
      config.setDataVersion('3');

      await migrationGlobal(ctx);

      expect(config.dataUrl.getMain()).toBe('https://example.com/v3/');
      expect(mocks.showMessageBox).not.toHaveBeenCalled();
    });

    it('v2 からは dataURL・更新日時をリセットして 3 にし、案内ダイアログを出す', async () => {
      config.dataUrl.setMain('https://example.com/custom/');
      config.setDataVersion('2');
      config.modDate.setCore(1000);

      await migrationGlobal(ctx);

      expect(config.getDataVersion()).toBe('3');
      expect(config.dataUrl.hasMain()).toBe(false);
      expect(config.modDate.hasCore()).toBe(false);
      expect(mocks.showMessageBox).toHaveBeenCalledOnce();
    });

    it('v1(dataVersion キー無し)からも確認なしで同じ最終状態になる', async () => {
      config.dataUrl.setMain(OLD_DEFAULT_DATA_URL);

      await migrationGlobal(ctx);

      expect(config.getDataVersion()).toBe('3');
      expect(config.dataUrl.hasMain()).toBe(false);
      // 移行するかどうかを尋ねず、結果の案内を 1 回出すだけ
      expect(mocks.showMessageBox).toHaveBeenCalledOnce();
    });

    it('案内ダイアログに移行前のデータ取得先を載せる', async () => {
      config.dataUrl.setMain('https://example.com/custom-v1/');

      await migrationGlobal(ctx);

      expect(mocks.showMessageBox.mock.calls[0][0]).toMatchObject({
        message: expect.stringContaining('https://example.com/custom-v1/'),
      });
    });

    it('リセットの前に config.json を退避する', async () => {
      config.dataUrl.setMain(OLD_DEFAULT_DATA_URL);

      await migrationGlobal(ctx);

      expect(mocks.downloadFile).toHaveBeenCalledWith(
        win,
        path.join(mocks.userDataDir.value, 'config.json'),
        { subDir: 'migration' },
      );
    });
  });

  describe('migrationByFolder', () => {
    it('apm.json が無ければ何もしない', async () => {
      await migrationByFolder(ctx, inst);
      expect(await pathExists(path.join(installationPath, 'apm.json'))).toBe(
        false,
      );
    });

    it('v1 の apm.json は repository を落として v3 になる', async () => {
      await writeJson(path.join(installationPath, 'apm.json'), {
        core: {},
        packages: {
          'author/pkg': {
            id: 'author/pkg',
            version: '1.0',
            repository:
              'https://cdn.jsdelivr.net/gh/team-apm/apm-data@main/data/packages_list.xml',
          },
        },
      });

      await migrationByFolder(ctx, inst);

      const ledger = await readJson(path.join(installationPath, 'apm.json'));
      expect(ledger.dataVersion).toBe('3');
      expect(ledger.packages['author/pkg'].repository).toBeUndefined();
      expect(ledger.packages['author/pkg'].version).toBe('1.0');
      // 段を踏まないのでバックアップは 1 回だけ
      expect(mocks.downloadFile).toHaveBeenCalledOnce();
    });

    it('v1 の packages_list.xml も同じ変換に流れる(リネームを経由しない)', async () => {
      await writeJson(path.join(installationPath, 'apm.json'), {
        core: {},
        packages: {},
      });
      await writeFile(
        path.join(installationPath, 'packages_list.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<packages>
  <package>
    <id>script_old</id>
    <name>スクリプト</name>
    <downloadURL>https://example.com/s.zip</downloadURL>
    <latestVersion>1</latestVersion>
    <files>
      <file>script/s.anm</file>
    </files>
  </package>
</packages>
`,
      );

      await migrationByFolder(ctx, inst);

      const converted = await readJson(inst.localRepoPath);
      expect(converted.packages[0].id).toBe('script_old');
      // 元のファイルは消さずに残す
      expect(
        await pathExists(path.join(installationPath, 'packages_list.xml')),
      ).toBe(true);
    });

    it('v2 の apm.json + packages.xml は packages.json へ変換される', async () => {
      await writeJson(path.join(installationPath, 'apm.json'), {
        dataVersion: '2',
        core: {},
        packages: {
          script_old: { id: 'script_old', version: '1', repository: 'x' },
        },
      });
      await writeFile(
        path.join(installationPath, 'packages.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<packages>
  <package>
    <id>script_old</id>
    <name>スクリプト</name>
    <downloadURL>https://example.com/s.zip</downloadURL>
    <latestVersion>1</latestVersion>
    <files>
      <file>script/s.anm</file>
    </files>
  </package>
</packages>
`,
      );

      await migrationByFolder(ctx, inst);

      const ledger = await readJson(path.join(installationPath, 'apm.json'));
      expect(ledger.dataVersion).toBe('3');
      expect(ledger.packages.script_old.repository).toBeUndefined();
      const converted = await readJson(
        path.join(installationPath, 'packages.json'),
      );
      expect(converted.packages).toHaveLength(1);
      expect(converted.packages[0].id).toBe('script_old');
    });

    it('ローカルリポジトリが壊れていても apm.json は v3 まで進み、エラーを知らせる', async () => {
      await writeJson(path.join(installationPath, 'apm.json'), {
        core: {},
        packages: { 'author/pkg': { id: 'author/pkg', version: '1.0' } },
      });
      await writeFile(
        path.join(installationPath, 'packages.xml'),
        '<packages><package>壊れている',
      );

      await migrationByFolder(ctx, inst);

      const ledger = await readJson(path.join(installationPath, 'apm.json'));
      expect(ledger.dataVersion).toBe('3');
      expect(await pathExists(inst.localRepoPath)).toBe(false);
      expect(mocks.showMessageBox).toHaveBeenCalledOnce();
    });

    it('バックアップを取れなかったときは apm.json を書き換えない', async () => {
      mocks.downloadFile.mockResolvedValueOnce(undefined as unknown as string);
      await writeJson(path.join(installationPath, 'apm.json'), {
        core: {},
        packages: { 'author/pkg': { id: 'author/pkg', repository: 'x' } },
      });

      await expect(migrationByFolder(ctx, inst)).rejects.toThrow(
        /Failed to back up/,
      );

      const ledger = await readJson(path.join(installationPath, 'apm.json'));
      expect(ledger.dataVersion).toBeUndefined();
      expect(ledger.packages['author/pkg'].repository).toBe('x');
    });

    it('v3 済みの apm.json には触れない', async () => {
      await writeJson(path.join(installationPath, 'apm.json'), {
        dataVersion: '3',
        core: {},
        packages: {},
      });

      await migrationByFolder(ctx, inst);

      expect(mocks.downloadFile).not.toHaveBeenCalled();
    });
  });
});
