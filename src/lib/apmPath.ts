import path from 'path';

/**
 * Determine the parent-child relationship of a path.
 *
 * @param {string} parent - Path expected to be a parent folder.
 * @param {string} child - Paths expected to be a child entry.
 * @returns {boolean} - Boolean value
 */
export function isParent(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return relative && relative !== '' && !relative.startsWith('..');
}

/**
 * Determine if two paths have a parent-child relationship.
 *
 * @param {string} pathA - A path
 * @param {string} pathB - A path
 * @returns {boolean} - Boolean value
 */
export function pathRelated(pathA: string, pathB: string) {
  return isParent(pathA, pathB) || isParent(pathB, pathA);
}
