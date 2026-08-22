import { mkdtemp, outputFile, pathExists, remove } from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearCache, getCacheSize } from './cache';

const mocks = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({
  app: { getPath: () => mocks.userData },
}));

/**
 * cache.ts の特性化テスト。削除対象を archive に限ること
 * (list.json 等の取得済みデータは残すこと)を仕様として固定する。
 */
describe('cache', () => {
  const tempDirs: string[] = [];

  const makeDataDir = async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'apm-cache-'));
    tempDirs.push(dir);
    mocks.userData = dir;
    return path.join(dir, 'Data');
  };

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => remove(dir)));
  });

  describe('getCacheSize', () => {
    it('アーカイブが無いときは 0 を返す', async () => {
      await makeDataDir();
      expect(await getCacheSize()).toBe(0);
    });

    it('core と package の archive を合算する', async () => {
      const dataDir = await makeDataDir();
      await outputFile(
        path.join(dataDir, 'core/archive/a.zip'),
        'x'.repeat(10),
      );
      await outputFile(
        path.join(dataDir, 'package/archive/b.zip'),
        'y'.repeat(20),
      );

      expect(await getCacheSize()).toBe(30);
    });

    it('archive の外にあるファイルは数えない', async () => {
      const dataDir = await makeDataDir();
      await outputFile(path.join(dataDir, 'list.json'), 'x'.repeat(100));
      await outputFile(
        path.join(dataDir, 'package/packages.json'),
        'y'.repeat(50),
      );
      await outputFile(
        path.join(dataDir, 'package/archive/a.zip'),
        'z'.repeat(5),
      );

      expect(await getCacheSize()).toBe(5);
    });

    it('入れ子のディレクトリも再帰的に数える', async () => {
      const dataDir = await makeDataDir();
      await outputFile(
        path.join(dataDir, 'package/archive/nested/deep/a.zip'),
        'x'.repeat(7),
      );

      expect(await getCacheSize()).toBe(7);
    });
  });

  describe('clearCache', () => {
    it('archive を削除し、解放したバイト数を返す', async () => {
      const dataDir = await makeDataDir();
      await outputFile(
        path.join(dataDir, 'package/archive/a.zip'),
        'x'.repeat(42),
      );

      expect(await clearCache()).toBe(42);
      expect(await pathExists(path.join(dataDir, 'package/archive'))).toBe(
        false,
      );
      expect(await getCacheSize()).toBe(0);
    });

    it('archive の外は消さない', async () => {
      const dataDir = await makeDataDir();
      await outputFile(path.join(dataDir, 'list.json'), 'x');
      await outputFile(path.join(dataDir, 'package/packages.json'), 'y');
      await outputFile(path.join(dataDir, 'package/archive/a.zip'), 'z');

      await clearCache();

      expect(await pathExists(path.join(dataDir, 'list.json'))).toBe(true);
      expect(
        await pathExists(path.join(dataDir, 'package/packages.json')),
      ).toBe(true);
    });

    it('アーカイブが無くても失敗しない', async () => {
      await makeDataDir();
      expect(await clearCache()).toBe(0);
    });
  });
});
