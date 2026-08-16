import { describe, expect, it } from 'vitest';
import { compareVersion, compareVersionOp } from './compareVersion';

describe('compareVersion', () => {
  it('returns 0 for identical versions', () => {
    expect(compareVersion('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersion('v1.0.0', '1.0.0')).toBe(0);
  });

  it('compares semver-style versions', () => {
    expect(compareVersion('1.0.0', '2.0.0')).toBeLessThan(0);
    expect(compareVersion('2.0.0', '1.0.0')).toBeGreaterThan(0);
    expect(compareVersion('v3.10', 'r11')).toBeLessThan(0);
  });

  it('normalizes Japanese and irregular version strings', () => {
    // '1.0beta' is normalized to the prerelease '1.0.0-beta' (< '1.0.0')
    expect(compareVersion('1.0beta', '1.0.0')).toBeLessThan(0);
    expect(compareVersion('1_2.0', '1.2.0')).toBe(0);
    expect(compareVersion('ver.2.0', '2.0.0')).toBe(0);
  });

  it('compares date versions', () => {
    expect(compareVersion('2022/02/02', '2022/03/01')).toBeLessThan(0);
    expect(compareVersion('2022/03/01', '2022/02/02')).toBeGreaterThan(0);
  });

  it('returns NaN when versions cannot be compared', () => {
    expect(compareVersion('2022/02/02', '1.0.0')).toBeNaN();
    expect(compareVersion('1.0.0', '2022/02/02')).toBeNaN();
    expect(compareVersion('not-a-version', 'also-invalid')).toBeNaN();
  });
});

describe('compareVersionOp', () => {
  it('evaluates operators for semver versions', () => {
    expect(compareVersionOp('1.0.0', '2.0.0', '<')).toBe(true);
    expect(compareVersionOp('2.0.0', '1.0.0', '>')).toBe(true);
    expect(compareVersionOp('1.0.0', '1.0.0', '=')).toBe(true);
  });

  it('evaluates operators for date versions', () => {
    expect(compareVersionOp('2022/02/02', '2022/03/01', '<')).toBe(true);
  });

  it('returns false when versions cannot be compared', () => {
    expect(compareVersionOp('2022/02/02', '1.0.0', '<')).toBe(false);
    expect(compareVersionOp('invalid', '1.0.0', '>')).toBe(false);
  });
});
