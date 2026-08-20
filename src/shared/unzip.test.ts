import { path7za } from '7zip-bin';
import {
  chmod,
  ensureDir,
  mkdtemp,
  pathExists,
  remove,
  symlink,
  writeFile,
} from 'fs-extra';
import { add } from 'node-7z';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import unzip, { removeSymlinks } from './unzip';

// The prebuilt 7za binary shipped by 7zip-bin is not always installed with
// the executable bit set (observed on some package manager / CI setups).
// Ensure it is runnable before exercising 7z, without touching production
// code (unzip.ts relies on the binary already being executable).
beforeAll(async () => {
  if (process.platform !== 'win32') {
    await chmod(path7za, 0o755);
  }
});

/**
 * Creates a zip archive fixture containing a single text file.
 * @param {string} dir - Directory in which to create the archive.
 * @returns {Promise<string>} Path to the created zip archive.
 */
async function createZipFixture(dir: string): Promise<string> {
  const zipPath = path.join(dir, 'fixture.zip');
  const fileName = 'hello.txt';
  await writeFile(path.join(dir, fileName), 'hello world');
  // node-7z 3.x does not actually wire up `$spawnOptions` to the spawned
  // child process, so a relative source path is resolved against the
  // current process cwd. Temporarily chdir into the fixture directory so
  // the archive stores a plain `hello.txt` entry instead of an absolute path.
  const originalCwd = process.cwd();
  process.chdir(dir);
  try {
    await new Promise<void>((resolve, reject) => {
      const stream = add(zipPath, fileName, { $bin: path7za });
      stream.once('end', () => resolve());
      stream.once('error', (err: Error) => reject(err));
    });
  } finally {
    process.chdir(originalCwd);
  }
  return zipPath;
}

describe('unzip', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => remove(dir)));
  });

  it('rejects when the zip path does not exist (regression: used to hang)', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'apm-unzip-'));
    tempDirs.push(dir);
    const missingZip = path.join(dir, 'missing.zip');

    await expect(unzip(missingZip)).rejects.toThrow(
      `Failed to unzip ${missingZip}`,
    );
  }, 30000);

  it('extracts a zip archive to the target directory', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'apm-unzip-'));
    tempDirs.push(dir);
    const zipPath = await createZipFixture(dir);

    const targetPath = await unzip(zipPath);

    expect(targetPath).toBe(path.join(dir, 'fixture'));
    expect(await pathExists(path.join(targetPath, 'hello.txt'))).toBe(true);
  }, 30000);
});

describe('removeSymlinks', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => remove(dir)));
  });

  // Windows の symlink 作成は特権が要るためテスト対象から外す
  it.skipIf(process.platform === 'win32')(
    '通常ファイルを残して symlink だけを再帰的に除去する',
    async () => {
      const dir = await mkdtemp(path.join(os.tmpdir(), 'apm-symlink-'));
      tempDirs.push(dir);
      const outside = path.join(dir, 'outside.txt');
      await writeFile(outside, 'secret');
      const extracted = path.join(dir, 'extracted');
      await ensureDir(path.join(extracted, 'sub'));
      await writeFile(path.join(extracted, 'normal.txt'), 'normal');
      await symlink(outside, path.join(extracted, 'link.txt'));
      await symlink(outside, path.join(extracted, 'sub', 'nested-link.txt'));

      await removeSymlinks(extracted);

      expect(await pathExists(path.join(extracted, 'normal.txt'))).toBe(true);
      expect(await pathExists(path.join(extracted, 'link.txt'))).toBe(false);
      expect(
        await pathExists(path.join(extracted, 'sub', 'nested-link.txt')),
      ).toBe(false);
      // リンク先(展開ディレクトリ外)のファイルは消えない
      expect(await pathExists(outside)).toBe(true);
    },
  );
});
