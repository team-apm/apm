import { describe, expect, it } from 'vitest';
import { asyncFlatMap } from './asyncFlatMap';

describe('asyncFlatMap', () => {
  it('各要素の非同期結果を 1 段だけ平坦化する', async () => {
    const result = await asyncFlatMap([1, 2], async (n) => [n, [n * 10]]);
    expect(result).toEqual([1, [10], 2, [20]]);
  });

  it('空配列は空配列を返す', async () => {
    expect(await asyncFlatMap([], async (n) => [n])).toEqual([]);
  });
});
