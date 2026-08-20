import { describe, expect, it } from 'vitest';
import {
  isHttpUrl,
  isSafeRelativePath,
  validatePackageInfo,
} from './packageInfoValidation';

describe('isSafeRelativePath', () => {
  it('通常の相対パスを許可する', () => {
    expect(isSafeRelativePath('plugin.auf')).toBe(true);
    expect(isSafeRelativePath('plugins/plugin.auf')).toBe(true);
    expect(isSafeRelativePath('script/dev/a.anm')).toBe(true);
    expect(isSafeRelativePath('日本語 フォルダ/ファイル.txt')).toBe(true);
  });

  it('.. セグメントを含むパスを拒否する', () => {
    expect(isSafeRelativePath('..')).toBe(false);
    expect(isSafeRelativePath('../evil.auf')).toBe(false);
    expect(isSafeRelativePath('plugins/../../evil.auf')).toBe(false);
    expect(isSafeRelativePath('plugins\\..\\evil.auf')).toBe(false);
  });

  it('絶対パス・ドライブレター・UNC を拒否する', () => {
    expect(isSafeRelativePath('/etc/passwd')).toBe(false);
    expect(isSafeRelativePath('C:\\Windows\\evil.dll')).toBe(false);
    expect(isSafeRelativePath('\\\\server\\share\\evil')).toBe(false);
  });

  it('空文字列と制御文字を拒否する', () => {
    expect(isSafeRelativePath('')).toBe(false);
    expect(isSafeRelativePath('a\0b')).toBe(false);
    expect(isSafeRelativePath('a\nb')).toBe(false);
  });

  it('.. を含むだけのファイル名は許可する', () => {
    expect(isSafeRelativePath('archive..zip')).toBe(true);
    expect(isSafeRelativePath('a..b/file.txt')).toBe(true);
  });
});

describe('isHttpUrl', () => {
  it('http(s) の URL を許可する', () => {
    expect(isHttpUrl('https://example.com/a.zip')).toBe(true);
    expect(isHttpUrl('http://example.com/a.zip')).toBe(true);
  });

  it('http(s) 以外のスキームを拒否する', () => {
    expect(isHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isHttpUrl('ftp://example.com/a.zip')).toBe(false);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('example.com/a.zip')).toBe(false);
  });
});

describe('validatePackageInfo', () => {
  const validInfo = {
    id: 'author/package',
    name: 'テスト',
    files: [{ filename: 'plugins/plugin.auf' }],
    downloadURLs: ['https://example.com/'],
  };

  it('正常な info をそのまま返す', () => {
    expect(validatePackageInfo(validInfo)).toBe(validInfo);
  });

  it('スキーマ外の表示用制約(名前の長さ等)は検証しない', () => {
    // 境界で守るのはセキュリティ不変条件のみ。サードパーティデータの
    // 緩い形(dataURL 自由入力の確定方針)を壊さない
    const loose = {
      ...validInfo,
      name: 'とても長い名前'.repeat(10),
      unknownField: true,
    };
    expect(validatePackageInfo(loose)).toBe(loose);
  });

  it('オブジェクトでない info を拒否する', () => {
    expect(() => validatePackageInfo(null)).toThrow(TypeError);
    expect(() => validatePackageInfo('info')).toThrow(TypeError);
  });

  it('files が配列でなければ拒否する', () => {
    expect(() => validatePackageInfo({ ...validInfo, files: {} })).toThrow(
      /files/,
    );
    const noFiles: Partial<typeof validInfo> = { ...validInfo };
    delete noFiles.files;
    expect(() => validatePackageInfo(noFiles)).toThrow(/files/);
  });

  it('外へ出る filename / archivePath を拒否する', () => {
    expect(() =>
      validatePackageInfo({
        ...validInfo,
        files: [{ filename: '../evil.auf' }],
      }),
    ).toThrow(/unsafe filename/);
    expect(() =>
      validatePackageInfo({
        ...validInfo,
        files: [{ filename: 'plugin.auf', archivePath: '../../outside' }],
      }),
    ).toThrow(/unsafe archivePath/);
  });

  it('パス区切りや制御文字を含む installer を拒否する', () => {
    expect(() =>
      validatePackageInfo({ ...validInfo, installer: 'dir/setup.exe' }),
    ).toThrow(/unsafe installer/);
    expect(() =>
      validatePackageInfo({ ...validInfo, installer: '..' }),
    ).toThrow(/unsafe installer/);
    expect(
      validatePackageInfo({ ...validInfo, installer: 'setup.exe' }),
    ).toBeTruthy();
  });

  it('制御文字を含む installArg を拒否する', () => {
    expect(() =>
      validatePackageInfo({ ...validInfo, installArg: '/S\nmalicious' }),
    ).toThrow(/unsafe installArg/);
    // 通常のメタ文字は execFileSync 側で無害化されるため境界では通す
    expect(
      validatePackageInfo({ ...validInfo, installArg: '/S /D=$instpath' }),
    ).toBeTruthy();
  });

  it('http(s) 以外の directURL / downloadURLs を拒否する', () => {
    expect(() =>
      validatePackageInfo({ ...validInfo, directURL: 'file:///C:/a.zip' }),
    ).toThrow(/directURL/);
    expect(() =>
      validatePackageInfo({
        ...validInfo,
        downloadURLs: ['https://example.com/', 'file:///C:/'],
      }),
    ).toThrow(/downloadURLs/);
  });
});
