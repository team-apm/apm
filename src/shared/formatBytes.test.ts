import { describe, expect, it } from 'vitest';
import { formatBytes } from './formatBytes';

describe('formatBytes', () => {
  it('1024 未満はバイトとして整数で表示する', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1)).toBe('1 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('1024 ごとに単位を繰り上げる', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 ** 2)).toBe('1 MB');
    expect(formatBytes(1024 ** 3)).toBe('1 GB');
    expect(formatBytes(1024 ** 4)).toBe('1 TB');
  });

  it('端数は小数第 1 位まで表示し、末尾の 0 は落とす', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(Math.round(1024 ** 2 * 2.25))).toBe('2.3 MB');
    expect(formatBytes(1024 ** 2)).toBe('1 MB');
  });

  it('TB を超えても単位は TB のまま桁を増やす', () => {
    expect(formatBytes(1024 ** 5)).toBe('1024 TB');
  });

  it('負数や NaN は 0 B として扱う', () => {
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(NaN)).toBe('0 B');
  });
});
