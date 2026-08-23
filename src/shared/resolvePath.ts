import path from 'node:path';
import { isParent } from './apmPath';

/**
 * Resolve paths.
 * @param {string} base - base path
 * @param {string} relative - relative path
 * @returns {string} - absolute path
 */
export function resolvePath(base: string, relative: string) {
  if (base.startsWith('http')) {
    // base はデータ取得先の「フォルダ」を指す(設定画面も「フォルダのURLを
    // 入力してください。」と案内する)。new URL() をそのまま使わないのは、
    // 末尾に / が無いと最後のセグメントをファイル名とみなして 1 階層上に
    // 解決してしまい、ローカルパス側の path.resolve(base, relative)
    // — 末尾セパレータの有無に影響されない — と挙動が食い違うため。
    // pathname だけを直すのは、base に付いたクエリ・フラグメントを
    // 文字列連結で壊さないため。
    const baseURL = new URL(base);
    if (!baseURL.pathname.endsWith('/')) baseURL.pathname += '/';
    const retURL = new URL(relative, baseURL);
    if (retURL.origin !== baseURL.origin) {
      throw new Error('list.json can only specify files from the same origin.');
    }
    if (!isParent(baseURL.pathname, retURL.pathname)) {
      throw new Error(
        'list.json can only specify files in the same or child directories.',
      );
    }
    return retURL.href;
  } else {
    const retStr = path.resolve(base, relative);
    if (!isParent(base, retStr)) {
      throw new Error(
        'list.json can only specify files in the same or child directories.',
      );
    }
    return retStr;
  }
}
