import path from 'node:path';

/**
 * Determine the parent-child relationship of a path.
 * @param {string} parent - Path expected to be a parent folder.
 * @param {string} child - Paths expected to be a child entry.
 * @returns {boolean} - Boolean value
 */
export function isParent(parent: string, child: string) {
  const relative = path.relative(parent, child);
  // 絶対パスを弾くのは Windows のため。win32 の path.relative は別ドライブや
  // UNC のように相対化できない相手に対して、相対パスではなく引数をそのまま
  // 返す(path.win32.relative('C:\\aviutl', 'D:\\evil') === 'D:\\evil')。
  // '..' で始まらないので、この検査が無いと「インストール先の内側」と
  // 判定されてしまう。POSIX の path.relative は絶対パスを返さないので無影響
  return Boolean(
    relative && !relative.startsWith('..') && !path.isAbsolute(relative),
  );
}

/**
 * Determine if two paths have a parent-child relationship.
 * @param {string} pathA - A path
 * @param {string} pathB - A path
 * @returns {boolean} - Boolean value
 */
export function pathRelated(pathA: string, pathB: string) {
  return isParent(pathA, pathB) || isParent(pathB, pathA);
}

/**
 * Resolves a path under {parent}, rejecting anything that escapes it.
 *
 * パッケージデータのファイル名・フォルダ名はリモート由来なので、結合結果が
 * インストール先の外を指していないか確かめてから書き込みに使う。文字列として
 * '..' を検査するのではなく解決後の位置で判定するのは、絶対パス指定や
 * 正規化で外へ出る形(`a/../../b`)も同じ関門で弾くため。
 * @param {string} parent - A path expected to contain the result.
 * @param {string[]} segments - Path segments to join under {parent}.
 * @returns {string} The resolved path inside {parent}.
 */
export function resolveInside(parent: string, ...segments: string[]) {
  const resolvedParent = path.resolve(parent);
  const resolved = path.resolve(resolvedParent, path.join(...segments));
  if (!isParent(resolvedParent, resolved)) {
    throw new Error(
      `An invalid path outside the base folder was specified. ${resolved}`,
    );
  }
  return resolved;
}
