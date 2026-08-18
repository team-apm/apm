import { mkdtemp, readJson, remove } from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Config from './Config';

/**
 * Config(electron-store ラッパー)の特性化テスト。
 * シングルトン化の前準備として、現行の挙動を仕様として固定する。
 * electron-store は絶対パスの cwd を渡すと electron 非依存で動作する。
 */
describe('Config', () => {
  const tempDirs: string[] = [];

  const makeCwd = async (): Promise<string> => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'apm-config-'));
    tempDirs.push(dir);
    return dir;
  };

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => remove(dir)));
  });

  describe('既定値', () => {
    it('未設定のキーは has が false で、get は既定値を返す', async () => {
      const config = new Config({ cwd: await makeCwd() });

      expect(config.hasDataVersion()).toBe(false);
      expect(config.getDataVersion()).toBe('3');

      expect(config.hasInstallationPath()).toBe(false);
      expect(config.getInstallationPath()).toBe('');

      expect(config.dataURL.hasMain()).toBe(false);
      expect(config.dataURL.getMain()).toBe('');
      expect(config.dataURL.hasExtra()).toBe(false);
      expect(config.dataURL.getExtra()).toBe('');
      expect(config.dataURL.hasPackages()).toBe(false);
      expect(config.dataURL.getPackages()).toEqual([]);

      expect(config.modDate.hasCore()).toBe(false);
      expect(config.modDate.getCore()).toBe(0);
      expect(config.modDate.hasPackages()).toBe(false);
      expect(config.modDate.getPackages()).toBe(0);
      expect(config.modDate.hasScripts()).toBe(false);
      expect(config.modDate.getScripts()).toBe(0);

      expect(config.checkDate.hasCore()).toBe(false);
      expect(config.checkDate.getCore()).toBe(0);
      expect(config.checkDate.hasPackages()).toBe(false);
      expect(config.checkDate.getPackages()).toBe(0);

      expect(config.hasAutoUpdate()).toBe(false);
      expect(config.getAutoUpdate()).toBe('notify');

      expect(config.hasZoomFactor()).toBe(false);
      expect(config.getZoomFactor()).toBe('1');
    });
  });

  describe('set / get', () => {
    it('set した値が get で返り、has が true になる', async () => {
      const config = new Config({ cwd: await makeCwd() });

      config.setDataVersion('2');
      expect(config.hasDataVersion()).toBe(true);
      expect(config.getDataVersion()).toBe('2');

      config.setInstallationPath('C:\\aviutl');
      expect(config.getInstallationPath()).toBe('C:\\aviutl');

      config.setAutoUpdate('download');
      expect(config.getAutoUpdate()).toBe('download');

      config.setZoomFactor('1.25');
      expect(config.getZoomFactor()).toBe('1.25');

      config.dataURL.setMain('https://example.com/data/');
      config.dataURL.setExtra('https://example.com/extra/');
      config.dataURL.setPackages(['https://example.com/packages.json']);
      expect(config.dataURL.getMain()).toBe('https://example.com/data/');
      expect(config.dataURL.getExtra()).toBe('https://example.com/extra/');
      expect(config.dataURL.getPackages()).toEqual([
        'https://example.com/packages.json',
      ]);

      config.modDate.setCore(100);
      config.modDate.setPackages(200);
      config.modDate.setScripts(300);
      expect(config.modDate.getCore()).toBe(100);
      expect(config.modDate.getPackages()).toBe(200);
      expect(config.modDate.getScripts()).toBe(300);

      config.checkDate.setCore(400);
      config.checkDate.setPackages(500);
      expect(config.checkDate.getCore()).toBe(400);
      expect(config.checkDate.getPackages()).toBe(500);
    });
  });

  describe('永続化', () => {
    it('cwd 直下の config.json にネストした JSON として即座に書き込まれる', async () => {
      const cwd = await makeCwd();
      const config = new Config({ cwd });

      config.dataURL.setMain('https://example.com/data/');
      config.modDate.setCore(123);

      // ドット区切りのキーはフラットな 'dataURL.main' ではなく入れ子で保存される
      const stored = await readJson(path.join(cwd, 'config.json'));
      expect(stored).toEqual({
        dataURL: { main: 'https://example.com/data/' },
        modDate: { core: 123 },
      });
    });

    it('同じ cwd を指す別インスタンスから書き込みが見える(状態はディスク共有)', async () => {
      const cwd = await makeCwd();
      const first = new Config({ cwd });
      const second = new Config({ cwd });

      first.setInstallationPath('C:\\aviutl');

      // インスタンスはメモリ上の状態を持たず、get のたびにディスクを読む。
      // シングルトン化はこの「複数インスタンスでも同期する」挙動を壊さないこと
      expect(second.hasInstallationPath()).toBe(true);
      expect(second.getInstallationPath()).toBe('C:\\aviutl');
    });
  });
});
