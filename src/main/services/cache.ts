import { app } from 'electron';
import { readdir, remove, stat } from 'fs-extra';
import path from 'node:path';

/**
 * Returns the directories holding downloaded archives.
 * 削除対象をアーカイブに限るのは、Data/ 直下の list.json 等が数十 KB で
 * 容量の利益がほとんど無いのに、消すとパッケージ一覧を取り直すまで
 * 何も表示できなくなるため。
 * @returns {string[]} Absolute paths of the archive directories.
 */
function getArchiveDirs(): string[] {
  const dataDir = path.join(app.getPath('userData'), 'Data');
  return ['core', 'package'].map((sub) => path.join(dataDir, sub, 'archive'));
}

/**
 * Returns the total size of the given directory in bytes.
 * 存在しないディレクトリは 0 として扱う(まだ何もダウンロードしていない)。
 * @param {string} dir - The directory to measure.
 * @returns {Promise<number>} The total size in bytes.
 */
async function dirSize(dir: string): Promise<number> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  const sizes = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return await dirSize(entryPath);
      // 途中で消えたファイルは 0 として数える(削除と競合しても壊れない)
      try {
        return (await stat(entryPath)).size;
      } catch {
        return 0;
      }
    }),
  );
  return sizes.reduce((total, size) => total + size, 0);
}

/**
 * Returns the total size of the downloaded archives in bytes.
 * @returns {Promise<number>} The total size in bytes.
 */
export async function getCacheSize(): Promise<number> {
  const sizes = await Promise.all(getArchiveDirs().map(dirSize));
  return sizes.reduce((total, size) => total + size, 0);
}

/**
 * Removes the downloaded archives.
 * インストール済みのパッケージには影響しない(配置済みのファイルは
 * インストール先にあり、ここにあるのは取得元のアーカイブだけ)。
 * @returns {Promise<number>} The number of bytes freed.
 */
export async function clearCache(): Promise<number> {
  const freed = await getCacheSize();
  await Promise.all(getArchiveDirs().map((dir) => remove(dir)));
  return freed;
}
