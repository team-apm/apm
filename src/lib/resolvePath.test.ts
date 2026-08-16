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

  describe('with a local base', () => {
    const base = path.join('/data', 'apm');

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
