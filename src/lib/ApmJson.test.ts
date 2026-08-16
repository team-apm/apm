import { mkdtemp, pathExists, readJson, remove, writeJson } from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { promises as fsPromises } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ApmJson from './ApmJson';

// 壊れた apm.json の読み込みテストでエラーログがテスト出力を汚さないようにする
vi.mock('electron-log', () => ({
  default: { error: vi.fn(), info: vi.fn() },
}));

/**
 * ApmJson の特性化テスト。
 * トランザクション化(begin/commit)の前準備として、現行の
 * 「set/delete のたびに即座に apm.json へ書き込む」挙動を仕様として固定する。
 */
describe('ApmJson', () => {
  const tempDirs: string[] = [];

  const makeInstPath = async (): Promise<string> => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'apm-json-'));
    tempDirs.push(dir);
    return dir;
  };

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => remove(dir)));
  });

  describe('getPath', () => {
    it('インストールディレクトリ直下の apm.json を指す', () => {
      expect(ApmJson.getPath('/foo/bar')).toBe(
        path.join('/foo/bar', 'apm.json'),
      );
    });
  });

  describe('load', () => {
    it('apm.json が存在しないときは既定のオブジェクトで初期化される', async () => {
      const instPath = await makeInstPath();
      const apmJson = await ApmJson.load(instPath);

      expect(await apmJson.get('dataVersion')).toBe('3');
      expect(await apmJson.get('core')).toEqual({});
      expect(await apmJson.get('packages')).toEqual({});
    });

    it('apm.json が存在しなくても load だけではファイルを作成しない', async () => {
      const instPath = await makeInstPath();
      await ApmJson.load(instPath);

      expect(await pathExists(ApmJson.getPath(instPath))).toBe(false);
    });

    it('apm.json が壊れているときは既定値になり、ファイルは書き換えられない', async () => {
      const instPath = await makeInstPath();
      const jsonPath = ApmJson.getPath(instPath);
      await fsPromises.writeFile(jsonPath, 'not a json {{{');

      const apmJson = await ApmJson.load(instPath);

      expect(await apmJson.get('dataVersion')).toBe('3');
      // 次の set まで壊れたファイルはそのまま残る(現行仕様)
      expect(await fsPromises.readFile(jsonPath, 'utf8')).toBe(
        'not a json {{{',
      );
    });
  });

  describe('get / has', () => {
    it('ドット区切りのパスでネストした値を取得できる', async () => {
      const instPath = await makeInstPath();
      await writeJson(ApmJson.getPath(instPath), {
        dataVersion: '3',
        core: { aviutl: '1.10', exedit: '0.92' },
        packages: {
          'author/plugin': { id: 'author/plugin', version: 'v1.0.0' },
        },
      });
      const apmJson = await ApmJson.load(instPath);

      expect(await apmJson.get('core.aviutl')).toBe('1.10');
      expect(await apmJson.get('packages')).toEqual({
        'author/plugin': { id: 'author/plugin', version: 'v1.0.0' },
      });
      expect(await apmJson.has('core.exedit')).toBe(true);
      expect(await apmJson.has('core.missing')).toBe(false);
    });

    it('存在しないキーは undefined、defaultValue 指定時はそれを返す', async () => {
      const instPath = await makeInstPath();
      const apmJson = await ApmJson.load(instPath);

      expect(await apmJson.get('convertMod')).toBeUndefined();
      expect(await apmJson.get('convertMod', 0)).toBe(0);
      // キーが存在する場合は defaultValue を使わない
      expect(await apmJson.get('dataVersion', 'fallback')).toBe('3');
      // 引数なし(空パス)はルートオブジェクトではなく undefined を返す(dot-prop 由来の現行仕様)
      expect(await apmJson.get()).toBeUndefined();
    });
  });

  describe('set / delete(即時書き込み)', () => {
    it('set は即座にファイルへ書き込む(ファイルが無ければ新規作成する)', async () => {
      const instPath = await makeInstPath();
      const jsonPath = ApmJson.getPath(instPath);
      const apmJson = await ApmJson.load(instPath);

      await apmJson.set('core.aviutl', '1.10');

      // メモリ上のインスタンスを経由せず、ディスクの内容を直接検証する
      expect(await readJson(jsonPath)).toEqual({
        dataVersion: '3',
        core: { aviutl: '1.10' },
        packages: {},
      });
    });

    it('連続した set はそのたびに全体を書き込む', async () => {
      const instPath = await makeInstPath();
      const jsonPath = ApmJson.getPath(instPath);
      const apmJson = await ApmJson.load(instPath);

      await apmJson.set('core.aviutl', '1.10');
      const afterFirst = await readJson(jsonPath);
      await apmJson.set('core.exedit', '0.92');
      const afterSecond = await readJson(jsonPath);

      expect(afterFirst.core).toEqual({ aviutl: '1.10' });
      expect(afterSecond.core).toEqual({ aviutl: '1.10', exedit: '0.92' });
    });

    it('delete はキーが無くてもファイルへ書き込み、親パスが辿れる限り true を返す', async () => {
      const instPath = await makeInstPath();
      const jsonPath = ApmJson.getPath(instPath);
      const apmJson = await ApmJson.load(instPath);

      // 存在しないキーの delete でも save が走り、ファイルが作成される(現行仕様)
      // 戻り値は「削除したかどうか」ではなく「親パスまで辿れたかどうか」(dot-prop 由来の現行仕様)
      expect(await apmJson.delete('core.missing')).toBe(true);
      expect(await pathExists(jsonPath)).toBe(true);
      // 中間パスが存在しない場合のみ false
      expect(await apmJson.delete('nonexistent.parent.key')).toBe(false);

      await apmJson.set('core.aviutl', '1.10');
      expect(await apmJson.delete('core.aviutl')).toBe(true);
      expect((await readJson(jsonPath)).core).toEqual({});
    });
  });

  describe('setCore / addPackage / removePackage', () => {
    it('setCore と addPackage は所定のキーに書き込み、removePackage で消える', async () => {
      const instPath = await makeInstPath();
      const jsonPath = ApmJson.getPath(instPath);
      const apmJson = await ApmJson.load(instPath);

      await apmJson.setCore('aviutl', '1.10');
      await apmJson.addPackage('author/plugin', 'v1.2.3');

      expect(await readJson(jsonPath)).toEqual({
        dataVersion: '3',
        core: { aviutl: '1.10' },
        packages: {
          'author/plugin': { id: 'author/plugin', version: 'v1.2.3' },
        },
      });

      await apmJson.removePackage('author/plugin');
      expect((await readJson(jsonPath)).packages).toEqual({});
    });

    it('ドットを含むパッケージ ID はネストしたキーとして解釈される(dot-prop 由来の現行仕様)', async () => {
      const instPath = await makeInstPath();
      const apmJson = await ApmJson.load(instPath);

      await apmJson.addPackage('author/plugin.en', 'v1.0.0');

      // packages['author/plugin.en'] ではなく packages['author/plugin'].en になる
      expect(await apmJson.get('packages')).toEqual({
        'author/plugin': {
          en: { id: 'author/plugin.en', version: 'v1.0.0' },
        },
      });
    });
  });

  describe('begin / commit(トランザクション)', () => {
    it('begin 中の set は書き込みを遅延し、commit で 1 回だけ書き込む', async () => {
      const instPath = await makeInstPath();
      const jsonPath = ApmJson.getPath(instPath);
      const apmJson = await ApmJson.load(instPath);

      apmJson.begin();
      await apmJson.set('core.aviutl', '1.10');
      await apmJson.set('core.exedit', '0.92');

      // commit まではディスクに書き込まれない
      expect(await pathExists(jsonPath)).toBe(false);
      // read-your-writes: メモリ上では set した値が見える
      expect(await apmJson.get('core.aviutl')).toBe('1.10');
      expect(await apmJson.has('core.exedit')).toBe(true);

      await apmJson.commit();
      expect(await readJson(jsonPath)).toEqual({
        dataVersion: '3',
        core: { aviutl: '1.10', exedit: '0.92' },
        packages: {},
      });
    });

    it('begin 中の delete も遅延され、戻り値の意味は変わらない', async () => {
      const instPath = await makeInstPath();
      const jsonPath = ApmJson.getPath(instPath);
      await writeJson(jsonPath, {
        dataVersion: '3',
        core: { aviutl: '1.10' },
        packages: {},
      });
      const apmJson = await ApmJson.load(instPath);

      apmJson.begin();
      // 戻り値は「親パスまで辿れたかどうか」(即時書き込み時と同じ)
      expect(await apmJson.delete('core.aviutl')).toBe(true);
      expect(await apmJson.delete('nonexistent.parent.key')).toBe(false);
      expect((await readJson(jsonPath)).core).toEqual({ aviutl: '1.10' });

      await apmJson.commit();
      expect((await readJson(jsonPath)).core).toEqual({});
    });

    it('変更がないまま commit してもファイルを書き込まない', async () => {
      const instPath = await makeInstPath();
      const apmJson = await ApmJson.load(instPath);

      apmJson.begin();
      // 存在しないキーの delete はオブジェクトを変更しないため dirty にならない
      await apmJson.delete('nonexistent.parent.key');
      await apmJson.commit();

      expect(await pathExists(ApmJson.getPath(instPath))).toBe(false);
    });

    it('commit 後の set は従来どおり即時書き込みに戻る', async () => {
      const instPath = await makeInstPath();
      const jsonPath = ApmJson.getPath(instPath);
      const apmJson = await ApmJson.load(instPath);

      apmJson.begin();
      await apmJson.set('core.aviutl', '1.10');
      await apmJson.commit();

      await apmJson.set('core.exedit', '0.92');
      expect((await readJson(jsonPath)).core).toEqual({
        aviutl: '1.10',
        exedit: '0.92',
      });
    });
  });

  describe('round-trip', () => {
    it('書き込んだ内容を別インスタンスで読み直しても同じ値になる', async () => {
      const instPath = await makeInstPath();

      const writer = await ApmJson.load(instPath);
      await writer.setCore('aviutl', '1.10');
      await writer.setCore('exedit', '0.92');
      await writer.addPackage('author/plugin', 'v1.2.3');

      expect(await readJson(ApmJson.getPath(instPath))).toEqual({
        dataVersion: '3',
        core: { aviutl: '1.10', exedit: '0.92' },
        packages: {
          'author/plugin': { id: 'author/plugin', version: 'v1.2.3' },
        },
      });

      const reader = await ApmJson.load(instPath);
      expect(await reader.get('core.aviutl')).toBe('1.10');
      expect(await reader.get('core.exedit')).toBe('0.92');
      expect(await reader.get('packages.author/plugin')).toEqual({
        id: 'author/plugin',
        version: 'v1.2.3',
      });
    });
  });
});
