import { describe, expect, it } from 'vitest';
import { convertV1ApmJsonPackages, convertV1PackageIds } from './packageId';

// services/packages.ts に重複していた ID 変換ループの特性化テスト。
// ID 例は実在の変換辞書の形式(v1 の連結形 → v2 以降の developer/name 形)。

describe('convertV1PackageIds', () => {
  it('辞書にある v1 ID を現行 ID へ書き換える(in place)', () => {
    const items = [{ id: 'MrOjii_LSMASHWorks' }, { id: 'rigaya/NVEnc' }];
    convertV1PackageIds(items, { MrOjii_LSMASHWorks: 'MrOjii/LSMASHWorks' });
    expect(items).toEqual([
      { id: 'MrOjii/LSMASHWorks' },
      { id: 'rigaya/NVEnc' },
    ]);
  });

  it('辞書に無い ID は変更しない', () => {
    const items = [{ id: 'rigaya/NVEnc' }];
    convertV1PackageIds(items, {});
    expect(items).toEqual([{ id: 'rigaya/NVEnc' }]);
  });

  it('継承プロパティ名の ID は hasOwnProperty 判定で変換しない', () => {
    const items = [{ id: 'toString' }];
    convertV1PackageIds(items, {});
    expect(items).toEqual([{ id: 'toString' }]);
  });
});

describe('convertV1ApmJsonPackages', () => {
  it('キーと id の両方を現行 ID へ書き換える(in place)', () => {
    const packages: { [key: string]: { id: string; version: string } } = {
      MrOjii_LSMASHWorks: { id: 'MrOjii_LSMASHWorks', version: 'v1' },
      'rigaya/NVEnc': { id: 'rigaya/NVEnc', version: 'v2' },
    };
    convertV1ApmJsonPackages(packages, {
      MrOjii_LSMASHWorks: 'MrOjii/LSMASHWorks',
    });
    expect(packages).toEqual({
      'MrOjii/LSMASHWorks': { id: 'MrOjii/LSMASHWorks', version: 'v1' },
      'rigaya/NVEnc': { id: 'rigaya/NVEnc', version: 'v2' },
    });
  });

  it('変換判定はキーで行い、新 ID の解決は packageItem.id を辞書に引く(既存挙動の保存)', () => {
    // キーと id が食い違うデータでは id 側の変換結果が採用され、
    // id が辞書に無ければ undefined キーになる(旧 convertId と同一)
    const packages = { oldKey: { id: 'unknownId' } };
    convertV1ApmJsonPackages(packages, { oldKey: 'new/key' });
    expect(packages).toEqual({ undefined: { id: undefined } });
  });
});
