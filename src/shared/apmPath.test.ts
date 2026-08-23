import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isParent, resolveInside } from './apmPath';

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

describe('resolveInside', () => {
  const installationPath = path.resolve('/data', 'aviutl');

  it('インストール先の中のパスをそのまま解決する', () => {
    expect(resolveInside(installationPath, 'plugins/foo.auf')).toBe(
      path.join(installationPath, 'plugins', 'foo.auf'),
    );
  });

  it('複数のセグメントを結合できる', () => {
    expect(
      resolveInside(installationPath, 'script', 'developer', 'a.anm'),
    ).toBe(path.join(installationPath, 'script', 'developer', 'a.anm'));
  });

  it('親ディレクトリへ脱出するパスを拒否する', () => {
    expect(() => resolveInside(installationPath, '../evil.exe')).toThrow();
    expect(() =>
      resolveInside(installationPath, 'plugins/../../evil.exe'),
    ).toThrow();
    expect(() =>
      resolveInside(installationPath, 'script', '../../..', 'evil'),
    ).toThrow(/invalid path/);
  });

  it('絶対パス指定を拒否する', () => {
    expect(() =>
      resolveInside(installationPath, path.resolve('/etc/passwd')),
    ).toThrow();
  });

  it('インストール先そのものを指すパスを拒否する', () => {
    // copy 先が installationPath 自体になる指定は書き込み対象として不正
    expect(() => resolveInside(installationPath, '.')).toThrow();
    expect(() => resolveInside(installationPath, '')).toThrow();
  });

  it('途中に .. があっても中に留まるなら許可する', () => {
    expect(resolveInside(installationPath, 'plugins/../script/a.anm')).toBe(
      path.join(installationPath, 'script', 'a.anm'),
    );
  });
});
