import { describe, expect, it } from 'vitest';
import {
  computeShareStringAlerts,
  parseShareString,
  shareStringRegex,
} from './shareString';

// sharePackages が生成する形式(絵文字に Variation Selector 付き)
const shareString =
  'ここにタイトルを入力🍎️1.0:3.10.0,🎞︎1.10,🎬︎0.92,aoytsk/easymp4,amate/aviutl1sc';

describe('parseShareString', () => {
  it('共有文字列を解析できる', () => {
    expect(shareStringRegex.test(shareString)).toBe(true);
    expect(parseShareString(shareString)).toEqual({
      share: '1.0',
      apm: '3.10.0',
      aviutl: '1.10',
      exedit: '0.92',
      packages: ['aoytsk/easymp4', 'amate/aviutl1sc'],
    });
  });

  it('パッケージ ID は小文字化される', () => {
    const parsed = parseShareString(
      'タイトル🍎️1.0:3.10.0,🎞︎1.10,🎬︎0.92,Aoytsk/EasyMP4',
    );
    expect(parsed?.packages).toEqual(['aoytsk/easymp4']);
  });

  it('パッケージなしでも解析できる', () => {
    const parsed = parseShareString('タイトル🍎️1.0:3.10.0,🎞︎1.10,🎬︎0.92');
    expect(parsed?.packages).toEqual([]);
  });

  it('通常の検索文字列は null になる', () => {
    expect(parseShareString('patch')).toBe(null);
  });
});

describe('computeShareStringAlerts', () => {
  const parsed = parseShareString(shareString)!;

  it('バージョンが一致すればアラートなし', () => {
    expect(
      computeShareStringAlerts(parsed, { aviutl: '1.10', exedit: '0.92' }),
    ).toEqual([]);
  });

  it('コアのバージョン違いは「非対応の場合があります」', () => {
    const alerts = computeShareStringAlerts(parsed, {
      aviutl: '1.00',
      exedit: '0.92',
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('AviUtl 1.10 用のデータです');
    expect(alerts[0]).toContain('非対応の場合があります');
  });

  it('コアが未インストール(undefined)なら「確認できませんでした」', () => {
    const alerts = computeShareStringAlerts(parsed, { exedit: '0.92' });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('互換性があるか確認できませんでした');
  });

  it('共有文字列側が新しい形式なら apm の更新を促す', () => {
    const newer = parseShareString('タイトル🍎️2.0:9.9.9,🎞︎1.10,🎬︎0.92')!;
    const alerts = computeShareStringAlerts(newer, {
      aviutl: '1.10',
      exedit: '0.92',
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('apmの更新が必要な場合があります');
  });
});
