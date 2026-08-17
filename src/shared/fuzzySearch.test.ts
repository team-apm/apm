import { describe, expect, it } from 'vitest';
import { fuzzyMatch, matchesFuzzyFilter } from './fuzzySearch';

// Plugins タブの一覧は list.js の fuzzySearch({ distance: 10000 })で
// 検索していた。React 化後も同じ挙動になるよう特性化する
const options = { distance: 10000 };

describe('fuzzyMatch', () => {
  it('完全一致はマッチする', () => {
    expect(fuzzyMatch('lua', 'lua', options)).toBe(true);
  });

  it('部分文字列はマッチする', () => {
    expect(fuzzyMatch('patch.aul', 'patch', options)).toBe(true);
  });

  it('長い文字列の途中でもマッチする(distance 10000 の意図)', () => {
    const longText =
      'この文章はとても長い概要文でありその末尾のほうに キーワード が含まれている'.toLowerCase();
    expect(fuzzyMatch(longText, 'キーワード', options)).toBe(true);
  });

  it('1 文字の打ち間違いを許容する', () => {
    expect(fuzzyMatch('easymp4', 'easymp3', options)).toBe(true);
  });

  it('全く関係ない文字列はマッチしない', () => {
    expect(fuzzyMatch('patch.aul', 'xyzxyzxyz', options)).toBe(false);
  });

  it('33 文字以上のパターンはマッチしない(bitap の制限)', () => {
    const pattern = 'a'.repeat(33);
    expect(fuzzyMatch(pattern + 'suffix', pattern, options)).toBe(false);
  });
});

describe('matchesFuzzyFilter', () => {
  const values = ['patch.aul', 'nazono', 'バグ修正やパフォーマンス改善'];

  it('いずれかの列にマッチすれば残る', () => {
    expect(matchesFuzzyFilter(values, 'patch', options)).toBe(true);
  });

  it('大文字小文字を区別しない', () => {
    expect(matchesFuzzyFilter(values, 'PATCH', options)).toBe(true);
  });

  it('空白区切りの全ての語がどこかの列にマッチする必要がある', () => {
    expect(matchesFuzzyFilter(values, 'patch nazono', options)).toBe(true);
    expect(matchesFuzzyFilter(values, 'patch zzzzzzzzz', options)).toBe(false);
  });

  it('どの列にもマッチしなければ残らない', () => {
    expect(matchesFuzzyFilter(values, 'qqqqqqqq', options)).toBe(false);
  });
});
