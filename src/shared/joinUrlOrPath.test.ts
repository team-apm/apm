import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { joinUrlOrPath } from './joinUrlOrPath';

describe('joinUrlOrPath', () => {
  describe('http(s) の base', () => {
    it('末尾スラッシュありの base に連結できる', () => {
      expect(
        joinUrlOrPath(
          'https://cdn.jsdelivr.net/gh/team-apm/apm-data@main/v3/',
          'list.json',
        ),
      ).toBe('https://cdn.jsdelivr.net/gh/team-apm/apm-data@main/v3/list.json');
    });

    it('末尾スラッシュなしの base に連結できる', () => {
      expect(joinUrlOrPath('https://example.com/data', 'list.json')).toBe(
        'https://example.com/data/list.json',
      );
    });

    it('URL をローカルパス形式に変換しない(Node 22 の path.join 対策)', () => {
      const joined = joinUrlOrPath('https://example.com/data/', 'list.json');
      expect(joined.startsWith('http')).toBe(true);
      expect(joined).not.toContain('\\');
    });
  });

  describe('ローカルパスの base', () => {
    it('path.join と同じ結果になる', () => {
      const base = path.resolve('/data', 'apm');
      expect(joinUrlOrPath(base, 'list.json')).toBe(
        path.join(base, 'list.json'),
      );
    });
  });
});
