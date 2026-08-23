import { describe, expect, it } from 'vitest';
import { fuzzyMatch, matchesSearchFilter } from './fuzzySearch';

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

describe('誤字数の上限(charsPerError)', () => {
  const strict = { ...options, charsPerError: 4 };

  it('3 文字のクエリは誤字を許さない', () => {
    expect(fuzzyMatch('lsd', 'psd', options)).toBe(true);
    expect(fuzzyMatch('lsd', 'psd', strict)).toBe(false);
  });

  it('3 文字でも完全に含まれていればマッチする', () => {
    expect(fuzzyMatch('psdtoolkit', 'psd', strict)).toBe(true);
  });

  it('7 文字なら 1 誤字を許す', () => {
    expect(fuzzyMatch('easymp4', 'easymp3', strict)).toBe(true);
  });

  it('長い文字列の末尾でも引ける(distance 10000 の意図は保つ)', () => {
    const longText =
      'この文章はとても長い概要文でありその末尾のほうに キーワード が含まれている'.toLowerCase();
    expect(fuzzyMatch(longText, 'キーワード', strict)).toBe(true);
  });
});

describe('matchesSearchFilter', () => {
  const fuzzy = ['patch.aul', 'nazono'];
  const substring = [
    'バグ修正やパフォーマンス改善',
    'https://example.com/patch',
  ];

  it('いずれかの列にマッチすれば残る', () => {
    expect(matchesSearchFilter(fuzzy, substring, 'patch', options)).toBe(true);
  });

  it('大文字小文字を区別しない', () => {
    expect(matchesSearchFilter(fuzzy, substring, 'PATCH', options)).toBe(true);
  });

  it('空白区切りの全ての語がどこかの列にマッチする必要がある', () => {
    expect(matchesSearchFilter(fuzzy, substring, 'patch nazono', options)).toBe(
      true,
    );
    expect(
      matchesSearchFilter(fuzzy, substring, 'patch zzzzzzzzz', options),
    ).toBe(false);
  });

  it('語ごとに fuzzy 列と部分一致列のどちらでマッチしてもよい', () => {
    // 'nazono' は fuzzy 列、'バグ修正' は部分一致列にしかない
    expect(
      matchesSearchFilter(fuzzy, substring, 'nazono バグ修正', options),
    ).toBe(true);
  });

  it('部分一致列は誤字を許さない', () => {
    // 'ﾊﾞｸﾞ' のような表記ゆれや 1 文字違いは部分一致列では拾わない
    expect(matchesSearchFilter([], substring, 'バグ修正', options)).toBe(true);
    expect(matchesSearchFilter([], substring, 'バク修正', options)).toBe(false);
  });

  it('URL を部分一致列へ回せば短い語が https に巻き込まれない', () => {
    // 実データではこれで "psd" が 285 件中 277 件 → 3 件になった
    const url = ['https://github.com/oov/aviutl_gcmzdrops'];
    expect(matchesSearchFilter(url, [], 'psd', options)).toBe(true);
    expect(matchesSearchFilter([], url, 'psd', options)).toBe(false);
  });

  it('どの列にもマッチしなければ残らない', () => {
    expect(matchesSearchFilter(fuzzy, substring, 'qqqqqqqq', options)).toBe(
      false,
    );
  });
});
