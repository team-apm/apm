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
    const retURL = new URL(relative, base);
    const baseURL = new URL(base);
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
