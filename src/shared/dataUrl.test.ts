import { describe, expect, it } from 'vitest';
import { DEFAULT_DATA_URL, validateDataUrls } from './dataUrl';

/**
 * validateDataUrls の特性化テスト。
 * 旧 setting.ts の setDataUrl が持っていた検証仕様を固定する。
 */
describe('validateDataUrls', () => {
  const noFile = () => false;

  it('メインが空のときは既定の apm-data URL に置き換わる', () => {
    const result = validateDataUrls('', '', noFile);
    expect(result.mainUrl).toBe(DEFAULT_DATA_URL);
    expect(result.errors).toEqual([]);
  });

  it('http(s) の URL は存在確認なしで通る', () => {
    const result = validateDataUrls('https://example.com/data/', '', noFile);
    expect(result.mainUrl).toBe('https://example.com/data/');
    expect(result.errors).toEqual([]);
  });

  it('http で始まらないメインは存在しなければエラー、存在すれば通る', () => {
    expect(validateDataUrls('C:\\data', '', noFile).errors).toEqual([
      '有効なURLまたは場所を入力してください。',
    ]);
    expect(validateDataUrls('C:\\data', '', () => true).errors).toEqual([]);
  });

  it('メインに .json を指定するとフォルダを要求するエラーになる', () => {
    const result = validateDataUrls(
      'https://example.com/packages.json',
      '',
      noFile,
    );
    expect(result.errors).toEqual(['フォルダのURLを入力してください。']);
  });

  it('追加 URL は改行区切りで、前後空白と空行が除去される', () => {
    const result = validateDataUrls(
      '',
      '  https://a.example/x.json  \r\n\r\nhttps://b.example/y.json\n   \n',
      noFile,
    );
    expect(result.extraUrls).toEqual([
      'https://a.example/x.json',
      'https://b.example/y.json',
    ]);
    expect(result.errors).toEqual([]);
  });

  it('追加 URL は .json でなければエラーになる(メインと逆の要求)', () => {
    const result = validateDataUrls('', 'https://example.com/data/', noFile);
    expect(result.errors).toEqual([
      '有効なJsonファイルのURLまたは場所を入力してください。(https://example.com/data/)',
    ]);
  });

  it('http で始まらない追加 URL は存在しなければ場所エラーも重なる', () => {
    const result = validateDataUrls('', 'C:\\packages.txt', noFile);
    // 場所エラーと .json エラーの両方が、この順で積まれる(現行仕様)
    expect(result.errors).toEqual([
      '有効なURLまたは場所を入力してください。(C:\\packages.txt)',
      '有効なJsonファイルのURLまたは場所を入力してください。(C:\\packages.txt)',
    ]);
  });

  it('エラーはメイン → 追加の順にすべて集まる', () => {
    const result = validateDataUrls(
      'bad-main.json',
      'https://a.example/ok.json\nbad-extra',
      noFile,
    );
    expect(result.errors).toEqual([
      '有効なURLまたは場所を入力してください。',
      'フォルダのURLを入力してください。',
      '有効なURLまたは場所を入力してください。(bad-extra)',
      '有効なJsonファイルのURLまたは場所を入力してください。(bad-extra)',
    ]);
  });
});
