import path from 'node:path';

/**
 * Joins a base URL or a local base path with a relative segment.
 * http(s) の base に path.join を使わないための関数。Electron 39(Node 22)の
 * Windows 版 path.join は URL を `.\https:\...` 形式に正規化してしまい、
 * downloadFile 等の `startsWith('http')` 判定がローカルパス扱いに化ける
 * (Electron 34 = Node 20 までは偶然動いていた)。
 * @param {string} base - The base URL or local path.
 * @param {string} segment - The relative segment to append.
 * @returns {string} The joined URL or path.
 */
export function joinUrlOrPath(base: string, segment: string) {
  if (base.startsWith('http')) {
    return base.replace(/\/+$/, '') + '/' + segment;
  }
  return path.join(base, segment);
}
