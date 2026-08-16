import { mkdtemp, remove } from 'fs-extra';
import * as os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Config from '../../lib/Config';
import { DEFAULT_DATA_URL } from '../../shared/dataUrl';
import { ensureExtraDataUrl, setDataUrls } from './settings';

/**
 * Settings サービスの特性化テスト。
 * 旧 setting.ts(renderer)が持っていた「検証が通ったときだけ config に
 * 書き込む」挙動を、main プロセスへの移設にあたって固定する。
 */
describe('settings service', () => {
  const tempDirs: string[] = [];

  const makeConfig = async (): Promise<Config> => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'apm-settings-'));
    tempDirs.push(dir);
    return new Config({ cwd: dir });
  };

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => remove(dir)));
  });

  describe('ensureExtraDataUrl', () => {
    it('追加 URL が未設定なら空文字列を設定する', async () => {
      const config = await makeConfig();

      const result = ensureExtraDataUrl(config);

      expect(config.dataURL.hasExtra()).toBe(true);
      expect(result).toEqual({ hasMain: false, extra: '' });
    });

    it('設定済みの値は変更せず、メイン URL の有無を返す', async () => {
      const config = await makeConfig();
      config.dataURL.setMain('https://example.com/data/');
      config.dataURL.setExtra('https://example.com/x.json');

      const result = ensureExtraDataUrl(config);

      expect(result).toEqual({
        hasMain: true,
        extra: 'https://example.com/x.json',
      });
    });
  });

  describe('setDataUrls', () => {
    it('検証が通ると main と extra(改行結合)を書き込む', async () => {
      const config = await makeConfig();

      const result = setDataUrls(
        config,
        'https://example.com/data/',
        'https://a.example/x.json\nhttps://b.example/y.json',
      );

      expect(result.errors).toEqual([]);
      expect(config.dataURL.getMain()).toBe('https://example.com/data/');
      expect(config.dataURL.getExtra()).toBe(
        ['https://a.example/x.json', 'https://b.example/y.json'].join(os.EOL),
      );
    });

    it('メインが空なら既定 URL が書き込まれる', async () => {
      const config = await makeConfig();

      const result = setDataUrls(config, '', '');

      expect(result.mainUrl).toBe(DEFAULT_DATA_URL);
      expect(config.dataURL.getMain()).toBe(DEFAULT_DATA_URL);
    });

    it('検証エラー時は config を変更しない', async () => {
      const config = await makeConfig();
      config.dataURL.setMain('https://example.com/data/');
      config.dataURL.setExtra('https://example.com/x.json');

      const result = setDataUrls(
        config,
        'https://example.com/broken.json',
        'not-a-json-url',
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(config.dataURL.getMain()).toBe('https://example.com/data/');
      expect(config.dataURL.getExtra()).toBe('https://example.com/x.json');
    });
  });
});
