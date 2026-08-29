import { describe, expect, it } from 'vitest';
import { dependencyDisplayName, unmetDependencyLabel } from './packageDisplay';

const nameOf = (id: string) =>
  ({ 'author/a': 'すごいプラグイン' })[id] as string | undefined;

describe('dependencyDisplayName', () => {
  it('一覧にあるパッケージは名前で出す', () => {
    expect(dependencyDisplayName('author/a', nameOf)).toBe('すごいプラグイン');
  });

  it('バージョン指定は落として名前だけを出す', () => {
    expect(dependencyDisplayName('author/a>=1.2', nameOf)).toBe(
      'すごいプラグイン',
    );
  });

  it('一覧に無い aviutl / exedit の擬似 ID は読める形に組み立てる', () => {
    expect(dependencyDisplayName('aviutl1.10', nameOf)).toBe('AviUtl 1.10');
    expect(dependencyDisplayName('exedit0.93rc1', nameOf)).toBe(
      '拡張編集 0.93rc1',
    );
  });

  it('解決できない ID はそのまま出す', () => {
    expect(dependencyDisplayName('author/unknown', nameOf)).toBe(
      'author/unknown',
    );
  });
});

describe('unmetDependencyLabel', () => {
  it('or 指定は「または」で繋ぐ', () => {
    expect(unmetDependencyLabel('aviutl1.10|exedit0.92', nameOf)).toBe(
      'AviUtl 1.10 または 拡張編集 0.92',
    );
  });
});
