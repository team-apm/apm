import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolvePath } from './resolvePath';

describe('resolvePath', () => {
  describe('with an http(s) base', () => {
    const base = 'https://example.com/data/';

    it('resolves a relative path on the same origin', () => {
      expect(resolvePath(base, 'packages/list.json')).toBe(
        'https://example.com/data/packages/list.json',
      );
    });

    it('throws for a different origin', () => {
      expect(() => resolvePath(base, 'https://evil.example/list.json')).toThrow(
        'list.json can only specify files from the same origin.',
      );
    });

    it('throws when the path escapes the base directory', () => {
      expect(() => resolvePath(base, '../secret.json')).toThrow(
        'list.json can only specify files in the same or child directories.',
      );
    });
  });

  // 設定画面は「フォルダのURLを入力してください。」としか案内しないので、
  // 末尾スラッシュ無しで保存された dataURL が現実に渡ってくる
  describe('末尾スラッシュの無い http(s) の base', () => {
    const base = 'https://example.com/data';

    it('フォルダの中として解決する', () => {
      expect(resolvePath(base, 'packages/list.json')).toBe(
        'https://example.com/data/packages/list.json',
      );
    });

    it('親ディレクトリへ出る相対パスは拒否する', () => {
      expect(() => resolvePath(base, '../secret.json')).toThrow(
        'list.json can only specify files in the same or child directories.',
      );
    });

    it('別オリジンは拒否する', () => {
      expect(() => resolvePath(base, 'https://evil.example/list.json')).toThrow(
        'list.json can only specify files from the same origin.',
      );
    });

    it('クエリ付きの base でもフォルダとして解決する', () => {
      expect(resolvePath('https://example.com/data?v=1', 'core.json')).toBe(
        'https://example.com/data/core.json',
      );
    });

    it('既定の dataURL から末尾スラッシュを落としても解決できる', () => {
      expect(
        resolvePath(
          'https://cdn.jsdelivr.net/gh/team-apm/apm-data@main/v3',
          'packages/rigaya.json',
        ),
      ).toBe(
        'https://cdn.jsdelivr.net/gh/team-apm/apm-data@main/v3/packages/rigaya.json',
      );
    });
  });

  describe('with a local base', () => {
    // path.join だと Windows でドライブレターが付かず、実装側の path.resolve の結果と一致しない
    const base = path.resolve('/data', 'apm');

    it('resolves a relative path inside the base directory', () => {
      expect(resolvePath(base, path.join('packages', 'list.json'))).toBe(
        path.join(base, 'packages', 'list.json'),
      );
    });

    it('throws when the path escapes the base directory', () => {
      expect(() => resolvePath(base, path.join('..', 'outside.json'))).toThrow(
        'list.json can only specify files in the same or child directories.',
      );
    });

    it('throws for an absolute path outside the base directory', () => {
      expect(() => resolvePath(base, path.join('/etc', 'passwd'))).toThrow(
        'list.json can only specify files in the same or child directories.',
      );
    });

    it('throws when the path resolves to the base directory itself', () => {
      expect(() => resolvePath(base, '.')).toThrow(
        'list.json can only specify files in the same or child directories.',
      );
    });
  });
});
