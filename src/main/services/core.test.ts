import { path7za } from '7zip-bin';
import type { BrowserWindow } from 'electron';
import {
  ensureDir,
  mkdtemp,
  pathExists,
  readFile,
  remove,
  writeFile,
  writeJson,
} from 'fs-extra';
import { execFileSync } from 'node:child_process';
import * as os from 'node:os';
import path from 'node:path';
import { fromData } from 'ssri';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Config from '../Config';
import { type Installation, openInstallation } from '../installation';
import Ledger from '../Ledger';
import {
  changeInstallationPath,
  ensureInstallationPath,
  getCoreDates,
  getCoreInfo,
  getInstalledVersionTexts,
  getLedgerCoreVersions,
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
vi.mock('./packageList', () => ({
  convertPackageIds: mocks.convertPackageIds,
  refreshPackagesList: mocks.refreshPackagesList,
}));
vi.mock('./scriptInstall', () => ({
  getScriptsList: mocks.getScriptsList,
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
  let installationPath: string;
  let ctx: { win: BrowserWindow; config: Config };
  let inst: Installation;

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
    installationPath = await makeTempDir('apm-inst-');
    config = new Config({ cwd: await makeTempDir('apm-config-') });
    ctx = { win, config };
    inst = openInstallation(installationPath);
  });

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => remove(dir)));
  });

  describe('getCoreInfo', () => {
    it('キャッシュが無ければ null を返す', async () => {
      expect(await getCoreInfo(ctx)).toBeNull();
    });

    it('キャッシュ済みの core.json を返す', async () => {
      await writeCachedCoreInfo({ aviutl: { latestVersion: '1.10' } });
      const info = await getCoreInfo(ctx);
      expect(info.aviutl.latestVersion).toBe('1.10');
    });
  });

  describe('getLedgerCoreVersions', () => {
    it('未記録なら undefined を返す', async () => {
      expect(await getLedgerCoreVersions(inst)).toEqual({
        aviutl: undefined,
        exedit: undefined,
      });
    });

    it('記録済みのバージョンを返す', async () => {
      const ledger = await Ledger.load(installationPath);
      await ledger.setCore('aviutl', '1.10');
      expect(await getLedgerCoreVersions(inst)).toEqual({
        aviutl: '1.10',
        exedit: undefined,
      });
    });
  });

  describe('hasExeditInPluginsFolder', () => {
    it('plugins/exedit.auf があるときだけ true', async () => {
      expect(hasExeditInPluginsFolder(inst)).toBe(false);
      await ensureDir(path.join(installationPath, 'plugins'));
      await writeFile(path.join(installationPath, 'plugins/exedit.auf'), 'x');
      expect(hasExeditInPluginsFolder(inst)).toBe(true);
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
      expect(await getInstalledVersionTexts(ctx, inst)).toEqual({
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
      expect(await installCoreProgram(ctx, inst, 'aviutl', '1.10')).toBe(
        'noVersionData',
      );
    });

    it('ダウンロード失敗は downloadFailed', async () => {
      await writeCachedCoreInfo(coreInfo);
      mocks.downloadFile.mockResolvedValueOnce(undefined);

      expect(await installCoreProgram(ctx, inst, 'aviutl', '1.10')).toBe(
        'downloadFailed',
      );
    });

    it('展開・配置に成功すると apm.json に記録して success', async () => {
      await writeCachedCoreInfo(coreInfo);
      mocks.downloadFile.mockResolvedValueOnce(await makeCoreZip());

      const result = await installCoreProgram(ctx, inst, 'aviutl', '1.10');

      expect(result).toBe('success');
      expect(await pathExists(path.join(installationPath, 'aviutl.exe'))).toBe(
        true,
      );
      const ledger = await Ledger.load(installationPath);
      expect(await ledger.get('core.aviutl')).toBe('1.10');
    });

    it('integrity 不一致で再ダウンロードを断ると corrupt', async () => {
      const withIntegrity = structuredClone(coreInfo);
      withIntegrity.aviutl.releases[0].integrity.archive =
        'sha384-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      await writeCachedCoreInfo(withIntegrity);
      mocks.downloadFile.mockResolvedValueOnce(await makeCoreZip());
      mocks.showMessageBox.mockResolvedValueOnce({ response: 1 });

      expect(await installCoreProgram(ctx, inst, 'aviutl', '1.10')).toBe(
        'corrupt',
      );
    });

    it('integrity 不一致の再ダウンロードに失敗すると redownloadFailed', async () => {
      const withIntegrity = structuredClone(coreInfo);
      withIntegrity.aviutl.releases[0].integrity.archive =
        'sha384-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      await writeCachedCoreInfo(withIntegrity);
      mocks.downloadFile.mockResolvedValueOnce(await makeCoreZip());
      mocks.showMessageBox.mockResolvedValueOnce({ response: 0 });
      mocks.downloadFile.mockResolvedValueOnce(undefined);

      expect(await installCoreProgram(ctx, inst, 'aviutl', '1.10')).toBe(
        'redownloadFailed',
      );
      expect(mocks.downloadFile).toHaveBeenLastCalledWith(
        win,
        'https://example.com/aviutl110.zip',
        { subDir: 'core' },
      );
    });

    it('integrity 不一致でも再ダウンロードで検証が通れば success', async () => {
      const zipPath = await makeCoreZip();
      const withIntegrity = structuredClone(coreInfo);
      withIntegrity.aviutl.releases[0].integrity.archive = fromData(
        await readFile(zipPath),
        { algorithms: ['sha384'] },
      ).toString();
      await writeCachedCoreInfo(withIntegrity);
      const corruptPath = path.join(
        mocks.userDataDir.value,
        'Data/core',
        'corrupt.zip',
      );
      await writeFile(corruptPath, 'tampered');
      mocks.downloadFile.mockResolvedValueOnce(corruptPath);
      mocks.showMessageBox.mockResolvedValueOnce({ response: 0 });
      mocks.downloadFile.mockResolvedValueOnce(zipPath);

      expect(await installCoreProgram(ctx, inst, 'aviutl', '1.10')).toBe(
        'success',
      );
      expect(await pathExists(path.join(installationPath, 'aviutl.exe'))).toBe(
        true,
      );
      const ledger = await Ledger.load(installationPath);
      expect(await ledger.get('core.aviutl')).toBe('1.10');
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

      await changeInstallationPath(ctx, inst);

      expect(config.getInstallationPath()).toBe(installationPath);
      expect(mocks.migrationByFolder).toHaveBeenCalledOnce();
      expect(mocks.getScriptsList).toHaveBeenCalledWith(ctx, true);
      // core の再取得は checkCoreLatestVersion 経由の downloadFile で観測する
      expect(mocks.downloadFile).toHaveBeenCalledWith(
        win,
        'https://example.com/core.json',
        { subDir: 'core' },
      );
      expect(mocks.refreshPackagesList).toHaveBeenCalledWith(ctx, inst);
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

      await changeInstallationPath(ctx, inst);

      expect(mocks.getScriptsList).not.toHaveBeenCalled();
      expect(mocks.downloadFile).not.toHaveBeenCalled();
      expect(mocks.refreshPackagesList).not.toHaveBeenCalled();
    });

    it('installationPath が存在しなければ migration も変換も行わない', async () => {
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
        ctx,
        openInstallation(path.join(installationPath, 'not-exist')),
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
      const ledger = await Ledger.load(installationPath);
      await ledger.set('convertMod', new Date('2026-01-01').getTime());

      await changeInstallationPath(ctx, inst);

      expect(mocks.convertPackageIds).toHaveBeenCalledWith(
        ctx,
        inst,
        new Date('2026-01-02').getTime(),
      );
    });
  });
});
