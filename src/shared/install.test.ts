import {
  mkdir,
  mkdtemp,
  pathExists,
  readFile,
  remove,
  writeFile,
} from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { install, verifyFilesByCount } from './install';

// 旧 src/renderer/main/common.ts の install / verifyFilesByCount の特性化テスト

const tempDirs: string[] = [];

/**
 * Creates a temporary directory removed after each test.
 * @param {string} prefix - A prefix of the directory name.
 * @returns {Promise<string>} The created directory.
 */
async function makeTempDir(prefix: string) {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => remove(dir)));
});

describe('verifyFilesByCount', () => {
  it('通常ファイルがすべて存在すれば true', async () => {
    const inst = await makeTempDir('apm-verify-');
    await writeFile(path.join(inst, 'a.auf'), '');
    expect(verifyFilesByCount(inst, [{ filename: 'a.auf' }])).toBe(true);
  });

  it('通常ファイルが欠けていれば false', async () => {
    const inst = await makeTempDir('apm-verify-');
    expect(verifyFilesByCount(inst, [{ filename: 'a.auf' }])).toBe(false);
  });

  it('isUninstallOnly と isObsolete のファイルは数えない', async () => {
    const inst = await makeTempDir('apm-verify-');
    expect(
      verifyFilesByCount(inst, [
        { filename: 'old.auf', isObsolete: true },
        { filename: 'readme.txt', isUninstallOnly: true },
      ]),
    ).toBe(true);
  });
});

describe('install', () => {
  it('isProgram はフォルダ全体をコピーする', async () => {
    const src = await makeTempDir('apm-install-src-');
    const inst = await makeTempDir('apm-install-dst-');
    await writeFile(path.join(src, 'aviutl.exe'), 'exe');
    await writeFile(path.join(src, 'readme.txt'), 'readme');

    const result = await install(src, inst, [{ filename: 'aviutl.exe' }], true);

    expect(result).toBe(true);
    expect(await readFile(path.join(inst, 'aviutl.exe'), 'utf8')).toBe('exe');
    expect(await pathExists(path.join(inst, 'readme.txt'))).toBe(true);
  });

  it('通常インストールは files に列挙されたファイルだけを配置する', async () => {
    const src = await makeTempDir('apm-install-src-');
    const inst = await makeTempDir('apm-install-dst-');
    await writeFile(path.join(src, 'plugin.auf'), 'plugin');
    await writeFile(path.join(src, 'readme.txt'), 'readme');

    const result = await install(src, inst, [
      { filename: 'plugins/plugin.auf' },
    ]);

    expect(result).toBe(true);
    expect(await readFile(path.join(inst, 'plugins/plugin.auf'), 'utf8')).toBe(
      'plugin',
    );
    expect(await pathExists(path.join(inst, 'readme.txt'))).toBe(false);
  });

  it('展開先のファイル名は filename の basename で解決する(archivePath 指定)', async () => {
    const src = await makeTempDir('apm-install-src-');
    const inst = await makeTempDir('apm-install-dst-');
    await mkdir(path.join(src, 'x64'));
    await writeFile(path.join(src, 'x64/plugin.auf'), 'x64 plugin');

    await install(src, inst, [
      { filename: 'plugins/plugin.auf', archivePath: 'x64' },
    ]);

    expect(await readFile(path.join(inst, 'plugins/plugin.auf'), 'utf8')).toBe(
      'x64 plugin',
    );
  });

  it('isObsolete のファイルは削除される', async () => {
    const src = await makeTempDir('apm-install-src-');
    const inst = await makeTempDir('apm-install-dst-');
    await writeFile(path.join(src, 'plugin.auf'), 'plugin');
    await writeFile(path.join(inst, 'old.auf'), 'old');

    await install(src, inst, [
      { filename: 'plugin.auf' },
      { filename: 'old.auf', isObsolete: true },
    ]);

    expect(await pathExists(path.join(inst, 'old.auf'))).toBe(false);
  });

  it('isUninstallOnly のファイルは展開元にあり展開先に無いときだけコピーする', async () => {
    const src = await makeTempDir('apm-install-src-');
    const inst = await makeTempDir('apm-install-dst-');
    await writeFile(path.join(src, 'plugin.auf'), 'plugin');
    await writeFile(path.join(src, 'config.ini'), 'default');
    await writeFile(path.join(inst, 'keep.ini'), 'user setting');

    await install(src, inst, [
      { filename: 'plugin.auf' },
      { filename: 'config.ini', isUninstallOnly: true },
      { filename: 'keep.ini', isUninstallOnly: true },
    ]);

    expect(await readFile(path.join(inst, 'config.ini'), 'utf8')).toBe(
      'default',
    );
    // 既存ファイルは上書きしない
    expect(await readFile(path.join(inst, 'keep.ini'), 'utf8')).toBe(
      'user setting',
    );
  });

  it('列挙されたファイルが展開元に無ければ元例外のまま失敗する', async () => {
    const src = await makeTempDir('apm-install-src-');
    const inst = await makeTempDir('apm-install-dst-');

    await expect(
      install(src, inst, [{ filename: 'missing.auf' }]),
    ).rejects.toThrow();
  });

  it('コピー後に検証が通らなければ Could not verify エラー', async () => {
    const src = await makeTempDir('apm-install-src-');
    const inst = await makeTempDir('apm-install-dst-');
    // isUninstallOnly は展開元に無ければコピーされないが、
    // 検証対象でもないため成功する。検証失敗を作るには
    // isProgram でコピーされないファイルを列挙する
    await writeFile(path.join(src, 'aviutl.exe'), 'exe');

    await expect(
      install(
        src,
        inst,
        [{ filename: 'aviutl.exe' }, { filename: 'exedit.auf' }],
        true,
      ),
    ).rejects.toThrow('Could not verify that the files was installed.');
  });

  it('展開ディレクトリの外を指す archivePath をコピー元にできない', async () => {
    const src = await makeTempDir('apm-install-src-');
    const inst = await makeTempDir('apm-install-dst-');
    // 展開ディレクトリの外にあるファイル(instPath 内へ持ち出される標的)
    await writeFile(path.join(src, '..', 'apm-install-secret.txt'), 'secret');

    await expect(
      install(src, inst, [
        { filename: 'plugins/apm-install-secret.txt', archivePath: '..' },
      ]),
    ).rejects.toThrow(/invalid path/);
    expect(
      await pathExists(path.join(inst, 'plugins/apm-install-secret.txt')),
    ).toBe(false);
    await remove(path.join(src, '..', 'apm-install-secret.txt'));
  });

  it('インストール先の外へ出る filename を拒否して書き込まない', async () => {
    const src = await makeTempDir('apm-install-src-');
    const inst = await makeTempDir('apm-install-dst-');
    const outside = path.join(inst, '..', 'escaped.auf');
    await writeFile(path.join(src, 'escaped.auf'), 'evil');

    await expect(
      install(src, inst, [{ filename: '../escaped.auf' }]),
    ).rejects.toThrow(/invalid path/);
    expect(await pathExists(outside)).toBe(false);
  });
});
