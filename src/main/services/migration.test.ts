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
  showMessageBox: vi.fn(async () => ({ response: 0 })),
  prompt: vi.fn(),
  downloadFile: vi.fn(),
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
vi.mock('electron-prompt', () => ({ default: mocks.prompt }));
vi.mock('./download', () => ({ downloadFile: mocks.downloadFile }));

const win = {} as BrowserWindow;

/**
 * migration サービスの特性化テスト。
 * v1 → v2 → v3 の段階移行の決定表(どの状態から始めても最終的に
 * dataVersion '3' で揃う)を、リネーム・分割に先立って固定する。
 */
describe('migration service', () => {
  const tempDirs: string[] = [];
  let config: Config;
  let instPath: string;
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
    instPath = await makeTempDir('apm-inst-');
    config = new Config({ cwd: await makeTempDir('apm-config-') });
    ctx = { win, config };
    inst = openInstallation(instPath);
    // v1 のキャッシュ掃除が readdir する Data/package を用意しておく
    await ensureDir(path.join(mocks.userDataDir.value, 'Data/package'));
  });

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => remove(dir)));
  });

  describe('migrationGlobal', () => {
    it('初回起動(main 未設定)は dataVersion 3 を書いて終わる', async () => {
      const result = await migrationGlobal(ctx);

      expect(result).toBe(true);
      expect(config.getDataVersion()).toBe('3');
      expect(mocks.showMessageBox).not.toHaveBeenCalled();
    });

    it('dataVersion 3 済みなら何もしない', async () => {
      config.dataURL.setMain('https://example.com/v3/');
      config.setDataVersion('3');

      const result = await migrationGlobal(ctx);

      expect(result).toBe(true);
      expect(config.dataURL.getMain()).toBe('https://example.com/v3/');
      expect(mocks.showMessageBox).not.toHaveBeenCalled();
    });

    it('v2 からは dataURL・更新日時をリセットして 3 にし、案内ダイアログを出す', async () => {
      config.dataURL.setMain('https://example.com/custom/');
      config.setDataVersion('2');
      config.modDate.setCore(1000);

      const result = await migrationGlobal(ctx);

      expect(result).toBe(true);
      expect(config.getDataVersion()).toBe('3');
      expect(config.dataURL.hasMain()).toBe(false);
      expect(config.modDate.hasCore()).toBe(false);
      expect(mocks.showMessageBox).toHaveBeenCalledOnce();
    });

    it('v1(旧デフォルト URL)からは確認なしで v2 を経由して 3 まで進む', async () => {
      // かつて setMain(undefined) が conf に拒否されクラッシュしていた経路
      // (#2397)。デフォルト利用者は dataURL.main が未設定へ戻る
      config.dataURL.setMain(OLD_DEFAULT_DATA_URL);

      const result = await migrationGlobal(ctx);

      expect(result).toBe(true);
      expect(config.getDataVersion()).toBe('3');
      expect(config.dataURL.hasMain()).toBe(false);
      // v2→3 の案内ダイアログの 1 回だけ(v1→2 の確認は旧デフォルトなら出ない)
      expect(mocks.showMessageBox).toHaveBeenCalledOnce();
    });

    it('v1(カスタム URL)でキャンセルを選ぶと false(起動中止)', async () => {
      config.dataURL.setMain('https://example.com/custom-v1/');
      mocks.showMessageBox.mockResolvedValueOnce({ response: 0 });

      const result = await migrationGlobal(ctx);

      expect(result).toBe(false);
      expect(config.hasDataVersion()).toBe(false);
    });
  });

  describe('migrationByFolder', () => {
    it('apm.json が無ければ何もしない', async () => {
      await migrationByFolder(ctx, inst);
      expect(await pathExists(path.join(instPath, 'apm.json'))).toBe(false);
    });

    it('v1 の apm.json は repository の書き換えを経て v3(repository 削除)まで進む', async () => {
      await writeJson(path.join(instPath, 'apm.json'), {
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

      const ledger = await readJson(path.join(instPath, 'apm.json'));
      expect(ledger.dataVersion).toBe('3');
      expect(ledger.packages['author/pkg'].repository).toBeUndefined();
      expect(ledger.packages['author/pkg'].version).toBe('1.0');
      // v1→2 と v2→3 の両方でバックアップされる
      expect(mocks.downloadFile).toHaveBeenCalledTimes(2);
    });

    it('v2 の apm.json + packages.xml は packages.json へ変換される', async () => {
      await writeJson(path.join(instPath, 'apm.json'), {
        dataVersion: '2',
        core: {},
        packages: {
          script_old: { id: 'script_old', version: '1', repository: 'x' },
        },
      });
      await writeFile(
        path.join(instPath, 'packages.xml'),
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

      const ledger = await readJson(path.join(instPath, 'apm.json'));
      expect(ledger.dataVersion).toBe('3');
      expect(ledger.packages.script_old.repository).toBeUndefined();
      const converted = await readJson(path.join(instPath, 'packages.json'));
      expect(converted.packages).toHaveLength(1);
      expect(converted.packages[0].id).toBe('script_old');
    });

    it('v3 済みの apm.json には触れない', async () => {
      await writeJson(path.join(instPath, 'apm.json'), {
        dataVersion: '3',
        core: {},
        packages: {},
      });

      await migrationByFolder(ctx, inst);

      expect(mocks.downloadFile).not.toHaveBeenCalled();
    });
  });
});
