import { describe, expect, it } from 'vitest';
import { buildInstallerArgs } from './installerArgs';

describe('buildInstallerArgs', () => {
  it('空白区切りの引数を配列にする', () => {
    expect(buildInstallerArgs('/S /NORESTART', 'C:\\aviutl')).toEqual([
      '/S',
      '/NORESTART',
    ]);
  });

  it('installArg が未定義なら空配列を返す', () => {
    expect(buildInstallerArgs(undefined, 'C:\\aviutl')).toEqual([]);
    expect(buildInstallerArgs('', 'C:\\aviutl')).toEqual([]);
  });

  it('$instpath をインストール先に置換する', () => {
    expect(buildInstallerArgs('/D=$instpath', 'C:\\aviutl')).toEqual([
      '/D=C:\\aviutl',
    ]);
  });

  it('引用符付きの $instpath も同じ 1 引数になる', () => {
    // 旧実装は '"$instpath"' を '$instpath' に戻してから引用符を付け直していた。
    // 引用符は引数の区切りを打ち消すだけなので結果は引用符なしと等価
    expect(buildInstallerArgs('/DIR="$instpath"', 'C:\\aviutl')).toEqual([
      '/DIR=C:\\aviutl',
    ]);
  });

  it('パスに空白が含まれても 1 引数のまま渡す', () => {
    expect(
      buildInstallerArgs('/DIR="$instpath"', 'C:\\Program Files\\aviutl'),
    ).toEqual(['/DIR=C:\\Program Files\\aviutl']);
    expect(
      buildInstallerArgs('/DIR=$instpath', 'C:\\Program Files\\aviutl'),
    ).toEqual(['/DIR=C:\\Program Files\\aviutl']);
  });

  it('引用符で囲まれた空白は引数を分割しない', () => {
    expect(buildInstallerArgs('/LOG="my log.txt" /S', 'C:\\aviutl')).toEqual([
      '/LOG=my log.txt',
      '/S',
    ]);
  });

  it('連続する空白を区切りとして畳み込む', () => {
    expect(buildInstallerArgs('  /S   /D=$instpath  ', 'C:\\a')).toEqual([
      '/S',
      '/D=C:\\a',
    ]);
  });

  it('空文字列の引数を 1 トークンとして残す', () => {
    expect(buildInstallerArgs('/S "" /D=$instpath', 'C:\\a')).toEqual([
      '/S',
      '',
      '/D=C:\\a',
    ]);
  });

  it('シェルのメタ文字を展開せずただの文字として扱う', () => {
    // execFileSync に shell 無しで渡す前提。& や | が別コマンドの起動に
    // ならないことをトークン境界で固定する
    expect(buildInstallerArgs('/S & calc.exe', 'C:\\aviutl')).toEqual([
      '/S',
      '&',
      'calc.exe',
    ]);
    expect(buildInstallerArgs('"/S && calc.exe"', 'C:\\aviutl')).toEqual([
      '/S && calc.exe',
    ]);
  });

  it('$instpath 由来の値をコマンドとして再解釈しない', () => {
    expect(buildInstallerArgs('/D=$instpath', 'C:\\a & calc.exe')).toEqual([
      '/D=C:\\a & calc.exe',
    ]);
  });

  it('$instpath が複数あればすべて置換する', () => {
    expect(buildInstallerArgs('/D=$instpath /L=$instpath', 'C:\\a')).toEqual([
      '/D=C:\\a',
      '/L=C:\\a',
    ]);
  });
});
