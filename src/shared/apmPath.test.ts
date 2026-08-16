import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isParent, pathRelated } from './apmPath';

describe('isParent', () => {
  it('returns true for a direct child path', () => {
    const parent = path.join('/data', 'apm');
    const child = path.join('/data', 'apm', 'packages.json');
    expect(isParent(parent, child)).toBe(true);
  });

  it('returns false for the same path', () => {
    const folder = path.join('/data', 'apm');
    expect(isParent(folder, folder)).toBe(false);
  });

  it('returns false for paths outside the parent', () => {
    const parent = path.join('/data', 'apm');
    const sibling = path.join('/data', 'other', 'file.json');
    expect(isParent(parent, sibling)).toBe(false);
  });
});

describe('pathRelated', () => {
  it('returns true when either path is a parent of the other', () => {
    const parent = path.join('/data', 'apm');
    const child = path.join('/data', 'apm', 'list.json');
    expect(pathRelated(parent, child)).toBe(true);
    expect(pathRelated(child, parent)).toBe(true);
  });

  it('returns false for unrelated paths', () => {
    const pathA = path.join('/data', 'apm');
    const pathB = path.join('/other', 'apm');
    expect(pathRelated(pathA, pathB)).toBe(false);
  });
});
