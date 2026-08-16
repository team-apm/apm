import { describe, expect, it } from 'vitest';
import {
  installedVersionDescription,
  installedVersionText,
  releaseLabel,
} from './coreVersionText';

// core.ts displayInstalledVersion / setCoreVersions の表示文字列の特性化テスト。
// バージョン例は実在の AviUtl('1.00' 等)と拡張編集('0.92'・'0.93rc1' 等)。

describe('installedVersionDescription', () => {
  it('最新版より古ければ最新版を案内する', () => {
    expect(installedVersionDescription('1.00', '1.10')).toBe(
      ' （最新版: 1.10）',
    );
  });

  it('最新版と一致すれば（最新版）', () => {
    expect(installedVersionDescription('1.10', '1.10')).toBe(' （最新版）');
  });

  it('rc 版はテスト版と表示する', () => {
    expect(installedVersionDescription('0.93rc1', '0.93rc1')).toBe(
      '（テスト版）',
    );
  });

  it('最新版より古い rc 版は最新版の案内を優先する', () => {
    expect(installedVersionDescription('0.93rc1', '0.93')).toBe(
      ' （最新版: 0.93）',
    );
  });

  it('比較不能(日付形式 vs semver)なら説明なし', () => {
    expect(installedVersionDescription('2022/02/02', '1.0.0')).toBe('');
  });
});

describe('installedVersionText', () => {
  it('ファイルが揃っていればバージョンと説明を表示する', () => {
    expect(installedVersionText('1.00', '1.10', true)).toBe(
      'バージョン: 1.00 （最新版: 1.10）',
    );
  });

  it('ファイルが欠けていれば未導入ファイルありを付ける', () => {
    expect(installedVersionText('1.10', '1.10', false)).toBe(
      'バージョン: 1.10 （最新版）（未導入ファイルあり）',
    );
  });

  it('apm.json に記録がなくてもファイルが揃っていれば手動インストール済み', () => {
    expect(installedVersionText(null, '1.10', true)).toBe(
      '手動インストール済み',
    );
  });

  it('記録もファイルもなければ未インストール', () => {
    expect(installedVersionText(null, '1.10', false)).toBe('未インストール');
  });

  it('比較不能でもバージョン自体は表示する', () => {
    expect(installedVersionText('2022/02/02', '1.0.0', true)).toBe(
      'バージョン: 2022/02/02',
    );
  });
});

describe('releaseLabel', () => {
  it('最新版には（最新版）を付ける', () => {
    expect(releaseLabel('1.10', '1.10')).toBe('1.10（最新版）');
  });

  it('旧版はバージョンのみ', () => {
    expect(releaseLabel('1.00', '1.10')).toBe('1.00');
  });

  it('rc 版には（テスト版）を付ける', () => {
    expect(releaseLabel('0.93rc1', '0.93')).toBe('0.93rc1（テスト版）');
  });

  it('rc 版が最新版なら両方付ける', () => {
    expect(releaseLabel('0.93rc1', '0.93rc1')).toBe(
      '0.93rc1（テスト版）（最新版）',
    );
  });
});
