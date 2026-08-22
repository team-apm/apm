import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { isParent, resolveInside } from './apmPath';

// isParent の判定は path.relative の結果に依存し、その挙動は OS で違う。
// 本番の対象は Windows だが CI のユニットテストは ubuntu で走るため、
// node:path を win32 実装に差し替えて Windows 側の判定を固定する。
vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path');
  return { ...actual.win32, default: actual.win32 };
});

describe('isParent (win32)', () => {
  it('同じドライブの子は内側と判定する', () => {
    expect(isParent('C:\\aviutl', 'C:\\aviutl\\plugins\\a.auf')).toBe(true);
  });

  it('別ドライブは内側と判定しない', () => {
    // path.win32.relative は相対化できず 'D:\\evil\\x' をそのまま返すので、
    // '..' 始まりの検査だけでは通り抜ける
    expect(path.win32.relative('C:\\aviutl', 'D:\\evil\\x')).toBe(
      'D:\\evil\\x',
    );
    expect(isParent('C:\\aviutl', 'D:\\evil\\x')).toBe(false);
  });

  it('UNC パスは内側と判定しない', () => {
    expect(isParent('C:\\aviutl', '\\\\srv\\share\\x')).toBe(false);
  });

  it('親へ出るパスは従来どおり内側と判定しない', () => {
    expect(isParent('C:\\aviutl', 'C:\\evil')).toBe(false);
  });
});

describe('resolveInside (win32)', () => {
  it('別ドライブを指すセグメントを拒否する', () => {
    expect(() => resolveInside('C:\\aviutl', 'D:\\evil\\x')).toThrow(
      /invalid path/,
    );
  });

  it('インストール先の中は従来どおり解決する', () => {
    expect(resolveInside('C:\\aviutl', 'plugins', 'a.auf')).toBe(
      'C:\\aviutl\\plugins\\a.auf',
    );
  });
});
