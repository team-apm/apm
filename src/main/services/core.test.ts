import { path7za } from '7zip-bin';
import type { BrowserWindow } from 'electron';
import {
  ensureDir,
  mkdtemp,
  pathExists,
  remove,
  writeFile,
  writeJson,
} from 'fs-extra';
import { execFileSync } from 'node:child_process';
import * as os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ApmJson from '../ApmJson';
import Config from '../Config';
import {
  changeInstallationPath,
  ensureInstallationPath,
  getApmJsonCoreVersions,
  getCoreDates,
  getCoreInfo,
  getInstalledVersionTexts,
  hasExeditInPluginsFolder,
  installCoreProgram,
} from './core';

const mocks = vi.hoisted(() => ({
  userDataDir: { value: '' },
  homeDir: { value: '' },
  showMessageBox: vi.fn(async () => ({ response: 0 })),
  downloadFile: vi.fn(),
  getInfo: vi.fn(),
  updateInfo: vi.fn(),
  getCoreDataUrl: vi.fn(async () => 'https://example.com/core.json'),
  getConvertDataUrl: vi.fn(),
  getScriptsDataUrl: vi.fn(),
  migrationByFolder: vi.fn(),
  convertPackageIds: vi.fn(),
  getScriptsList: vi.fn(),
  refreshPackagesList: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return mocks.userDataDir.value;
      if (name === 'home') return mocks.homeDir.value;
      throw new Error(`Unexpected getPath: ${name}`);
    },
  },
  dialog: { showMessageBox: mocks.showMessageBox },
  BrowserWindow: class {},
}));
vi.mock('electron-log/main', () => ({
  default: { error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../shortcut', () => ({
  addAviUtlShortcut: vi.fn(),
  removeAviUtlShortcut: vi.fn(),
}));
vi.mock('./download', () => ({ downloadFile: mocks.downloadFile }));
vi.mock('./modList', () => ({
  getInfo: mocks.getInfo,
  updateInfo: mocks.updateInfo,
  getCoreDataUrl: mocks.getCoreDataUrl,
  getConvertDataUrl: mocks.getConvertDataUrl,
  getScriptsDataUrl: mocks.getScriptsDataUrl,
}));
vi.mock('./migration', () => ({
  migrationByFolder: mocks.migrationByFolder,
}));
vi.mock('./packages', () => ({
  convertPackageIds: mocks.convertPackageIds,
  getScriptsList: mocks.getScriptsList,
  refreshPackagesList: mocks.refreshPackagesList,
}));

const win = {} as BrowserWindow;

/**
 * core サービスの特性化テスト。
 * Phase 5(設計しなおし)のリネーム・分割に先立ち、現行の挙動を固定する。
 * ネットワーク(download / modList)と他サービスだけを偽物にし、
 * キャッシュファイル・apm.json・zip 展開は実物を使う。
 */
describe('core service', () => {
  const tempDirs: string[] = [];
  let config: Config;
  let instPath: string;

  const makeTempDir = async (prefix: string): Promise<string> => {
    const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  };

  /**
   * Writes the cached core.json the way tempFile.ts resolves it.
   * @param {object} json - The JSON content to cache.
   * @returns {Promise<string>} The path of the cached file.
   */
  const writeCachedCoreInfo = async (json: object) => {
    const file = path.join(mocks.userDataDir.value, 'Data/core', 'core.json');
    await ensureDir(path.dirname(file));
    await writeJson(file, json);
    return file;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.userDataDir.value = await makeTempDir('apm-userdata-');
    mocks.homeDir.value = await makeTempDir('apm-home-');
    instPath = await makeTempDir('apm-inst-');
    config = new Config({ cwd: await makeTempDir('apm-config-') });
  });

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => remove(dir)));
  });

  describe('getCoreInfo', () => {
    it('キャッシュが無ければ null を返す', async () => {
      expect(await getCoreInfo(win, config)).toBeNull();
    });

    it('キャッシュ済みの core.json を返す', async () => {
      await writeCachedCoreInfo({ aviutl: { latestVersion: '1.10' } });
      const info = await getCoreInfo(win, config);
      expect(info.aviutl.latestVersion).toBe('1.10');
    });
  });

  describe('getApmJsonCoreVersions', () => {
    it('未記録なら undefined を返す', async () => {
      expect(await getApmJsonCoreVersions(instPath)).toEqual({
        aviutl: undefined,
        exedit: undefined,
      });
    });

    it('記録済みのバージョンを返す', async () => {
      const apmJson = await ApmJson.load(instPath);
      await apmJson.setCore('aviutl', '1.10');
      expect(await getApmJsonCoreVersions(instPath)).toEqual({
        aviutl: '1.10',
        exedit: undefined,
      });
    });
  });

  describe('hasExeditInPluginsFolder', () => {
    it('plugins/exedit.auf があるときだけ true', async () => {
      expect(hasExeditInPluginsFolder(instPath)).toBe(false);
      await ensureDir(path.join(instPath, 'plugins'));
      await writeFile(path.join(instPath, 'plugins/exedit.auf'), 'x');
      expect(hasExeditInPluginsFolder(instPath)).toBe(true);
    });
  });

  describe('ensureInstallationPath', () => {
    it('未設定なら home/aviutl を既定値として書き込む', () => {
      const result = ensureInstallationPath(config);
      expect(result).toBe(path.join(mocks.homeDir.value, 'aviutl'));
      expect(config.getInstallationPath()).toBe(result);
    });

    it('設定済みなら変更しない', () => {
      config.setInstallationPath('/custom/aviutl');
      expect(ensureInstallationPath(config)).toBe('/custom/aviutl');
    });
  });

  describe('getCoreDates', () => {
    it('modDate が無ければ null', () => {
      expect(getCoreDates(config)).toBeNull();
    });

    it('記録済みの日時を返す', () => {
      config.modDate.setCore(1000);
      config.checkDate.setCore(2000);
      expect(getCoreDates(config)).toEqual({ modDate: 1000, checkDate: 2000 });
    });
  });

  describe('getInstalledVersionTexts', () => {
    it('core.json が未取得なら両方とも未取得になる', async () => {
      expect(await getInstalledVersionTexts(win, config, instPath)).toEqual({
        aviutl: '未取得',
        exedit: '未取得',
      });
    });
  });

  describe('installCoreProgram', () => {
    const coreInfo = {
      aviutl: {
        latestVersion: '1.10',
        files: [{ filename: 'aviutl.exe' }],
        releases: [
          {
            version: '1.10',
            url: 'https://example.com/aviutl110.zip',
            integrity: { archive: '', file: [] as string[] },
          },
        ],
      },
    };

    /**
     * Creates a real zip in Data/core containing an aviutl.exe.
     * @returns {Promise<string>} The path of the zip file.
     */
    const makeCoreZip = async () => {
      const coreDir = path.join(mocks.userDataDir.value, 'Data/core');
      await ensureDir(coreDir);
      const srcDir = await makeTempDir('apm-zipsrc-');
      await writeFile(path.join(srcDir, 'aviutl.exe'), 'dummy exe');
      const zipPath = path.join(coreDir, 'aviutl110.zip');
      execFileSync(path7za, ['a', zipPath, path.join(srcDir, '*')]);
      return zipPath;
    };

    it('バージョンデータが無ければ noVersionData', async () => {
      expect(
        await installCoreProgram(win, config, 'aviutl', '1.10', instPath),
      ).toBe('noVersionData');
    });

    it('ダウンロード失敗は downloadFailed', async () => {
      await writeCachedCoreInfo(coreInfo);
      mocks.downloadFile.mockResolvedValueOnce(undefined);

      expect(
        await installCoreProgram(win, config, 'aviutl', '1.10', instPath),
      ).toBe('downloadFailed');
    });

    it('展開・配置に成功すると apm.json に記録して success', async () => {
      await writeCachedCoreInfo(coreInfo);
      mocks.downloadFile.mockResolvedValueOnce(await makeCoreZip());

      const result = await installCoreProgram(
        win,
        config,
        'aviutl',
        '1.10',
        instPath,
      );

      expect(result).toBe('success');
      expect(await pathExists(path.join(instPath, 'aviutl.exe'))).toBe(true);
      const apmJson = await ApmJson.load(instPath);
      expect(await apmJson.get('core.aviutl')).toBe('1.10');
    });

    it('integrity 不一致で再ダウンロードを断ると corrupt', async () => {
      const withIntegrity = structuredClone(coreInfo);
      withIntegrity.aviutl.releases[0].integrity.archive =
        'sha384-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      await writeCachedCoreInfo(withIntegrity);
      mocks.downloadFile.mockResolvedValueOnce(await makeCoreZip());
      mocks.showMessageBox.mockResolvedValueOnce({ response: 1 });

      expect(
        await installCoreProgram(win, config, 'aviutl', '1.10', instPath),
      ).toBe('corrupt');
    });
  });

  describe('changeInstallationPath', () => {
    const modInfo = (dates: {
      scripts: string;
      core: string;
      packages: string;
    }) => ({
      scripts: [{ path: 's.json', modified: dates.scripts }],
      core: { path: 'core.json', modified: dates.core },
      packages: [{ path: 'p.json', modified: dates.packages }],
    });

    it('mod 情報が新しければ scripts・core・packages を再取得する', async () => {
      mocks.getInfo.mockResolvedValue(
        modInfo({
          scripts: '2026-01-02',
          core: '2026-01-02',
          packages: '2026-01-02',
        }),
      );
      config.modDate.setScripts(new Date('2026-01-01').getTime());
      config.modDate.setCore(new Date('2026-01-01').getTime());
      config.modDate.setPackages(new Date('2026-01-01').getTime());

      await changeInstallationPath(win, config, instPath);

      expect(config.getInstallationPath()).toBe(instPath);
      expect(mocks.migrationByFolder).toHaveBeenCalledOnce();
      expect(mocks.getScriptsList).toHaveBeenCalledWith(win, config, true);
      // core の再取得は checkCoreLatestVersion 経由の downloadFile で観測する
      expect(mocks.downloadFile).toHaveBeenCalledWith(
        win,
        'https://example.com/core.json',
        { subDir: 'core' },
      );
      expect(mocks.refreshPackagesList).toHaveBeenCalledWith(
        win,
        config,
        instPath,
      );
    });

    it('mod 情報が古ければ何も再取得しない', async () => {
      mocks.getInfo.mockResolvedValue(
        modInfo({
          scripts: '2026-01-01',
          core: '2026-01-01',
          packages: '2026-01-01',
        }),
      );
      config.modDate.setScripts(new Date('2026-01-02').getTime());
      config.modDate.setCore(new Date('2026-01-02').getTime());
      config.modDate.setPackages(new Date('2026-01-02').getTime());

      await changeInstallationPath(win, config, instPath);

      expect(mocks.getScriptsList).not.toHaveBeenCalled();
      expect(mocks.downloadFile).not.toHaveBeenCalled();
      expect(mocks.refreshPackagesList).not.toHaveBeenCalled();
    });

    it('instPath が存在しなければ migration も変換も行わない', async () => {
      mocks.getInfo.mockResolvedValue(
        modInfo({
          scripts: '2026-01-01',
          core: '2026-01-01',
          packages: '2026-01-01',
        }),
      );
      config.modDate.setScripts(new Date('2026-01-02').getTime());
      config.modDate.setCore(new Date('2026-01-02').getTime());
      config.modDate.setPackages(new Date('2026-01-02').getTime());

      await changeInstallationPath(
        win,
        config,
        path.join(instPath, 'not-exist'),
      );

      expect(mocks.migrationByFolder).not.toHaveBeenCalled();
      expect(mocks.convertPackageIds).not.toHaveBeenCalled();
    });

    it('変換辞書が更新されていれば convertPackageIds を呼ぶ', async () => {
      mocks.getInfo.mockResolvedValue({
        ...modInfo({
          scripts: '2026-01-01',
          core: '2026-01-01',
          packages: '2026-01-01',
        }),
        convert: { path: 'convert.json', modified: '2026-01-02' },
      });
      config.modDate.setScripts(new Date('2026-01-02').getTime());
      config.modDate.setCore(new Date('2026-01-02').getTime());
      config.modDate.setPackages(new Date('2026-01-02').getTime());
      // apm.json が存在し convertMod が古い
      const apmJson = await ApmJson.load(instPath);
      await apmJson.set('convertMod', new Date('2026-01-01').getTime());

      await changeInstallationPath(win, config, instPath);

      expect(mocks.convertPackageIds).toHaveBeenCalledWith(
        win,
        config,
        instPath,
        new Date('2026-01-02').getTime(),
      );
    });
  });
});
