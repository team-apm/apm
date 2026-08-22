import { describe, expect, it } from 'vitest';
import { parsePackagesXml } from './parsePackagesXml';

// v2 時代のスクリプト配布サイト取り込み機能が生成していた packages.xml を
// 模した fixture。属性付き file・continuous 付き latestVersion・
// releases(integrities / archiveIntegrity)・dependencies を網羅する
const fixtureXml = `<?xml version="1.0" encoding="utf-8"?>
<packages>
  <package>
    <id>demo/plugin</id>
    <name>デモプラグイン</name>
    <overview>概要文</overview>
    <description>説明文</description>
    <developer>demo-dev</developer>
    <dependencies>
      <dependency>dep/one</dependency>
    </dependencies>
    <pageURL>https://example.com/page</pageURL>
    <downloadURL>https://example.com/dl.zip</downloadURL>
    <downloadMirrorURL>https://example.com/mirror.zip</downloadMirrorURL>
    <latestVersion continuous="true">1.2.3</latestVersion>
    <files>
      <file>plugin.auf</file>
      <file optional="true" archivePath="sub">readme.txt</file>
      <file directory="true">docs</file>
      <file obsolete="true" installOnly="true">old.auf</file>
    </files>
    <releases>
      <release version="1.2.3">
        <archiveIntegrity>sha384-AAA</archiveIntegrity>
        <integrities>
          <integrity target="plugin.auf">sha384-BBB</integrity>
        </integrities>
      </release>
    </releases>
  </package>
  <package>
    <id>demo/script</id>
    <name>スクリプト</name>
    <downloadURL>https://example.com/s.zip</downloadURL>
    <latestVersion>0.1</latestVersion>
    <files>
      <file>script.anm</file>
    </files>
  </package>
</packages>
`;

describe('parsePackagesXml', () => {
  it('パッケージを id をキーとした一覧として返す', () => {
    const packages = parsePackagesXml(fixtureXml);
    expect(Object.keys(packages)).toEqual(['demo/plugin', 'demo/script']);
    expect(packages['demo/script'].name).toBe('スクリプト');
    expect(packages['demo/script'].latestVersion).toBe('0.1');
    expect(packages['demo/script'].isContinuous).toBeUndefined();
  });

  it('基本フィールドと dependencies を取り込む', () => {
    const p = packagesOf('demo/plugin');
    expect(p.name).toBe('デモプラグイン');
    expect(p.overview).toBe('概要文');
    expect(p.description).toBe('説明文');
    expect(p.developer).toBe('demo-dev');
    expect(p.pageURL).toBe('https://example.com/page');
    expect(p.downloadURL).toBe('https://example.com/dl.zip');
    expect(p.downloadMirrorURL).toBe('https://example.com/mirror.zip');
    expect(p.dependencies).toEqual({ dependency: ['dep/one'] });
  });

  it('continuous 属性付きの latestVersion を分解する', () => {
    const p = packagesOf('demo/plugin');
    expect(p.latestVersion).toBe('1.2.3');
    expect(p.isContinuous).toBe(true);
  });

  it('file 要素の属性をフラグへ変換する', () => {
    const p = packagesOf('demo/plugin');
    expect(p.files).toEqual([
      {
        filename: 'plugin.auf',
        isOptional: false,
        isInstallOnly: false,
        isDirectory: false,
        isObsolete: false,
        archivePath: null,
      },
      {
        filename: 'readme.txt',
        isOptional: true,
        isInstallOnly: false,
        isDirectory: false,
        isObsolete: false,
        archivePath: 'sub',
      },
      {
        filename: 'docs',
        isOptional: false,
        isInstallOnly: false,
        isDirectory: true,
        isObsolete: false,
        archivePath: null,
      },
      {
        filename: 'old.auf',
        isOptional: false,
        isInstallOnly: true,
        isDirectory: false,
        isObsolete: true,
        archivePath: null,
      },
    ]);
  });

  it('releases をバージョンをキーとした integrity 情報へ変換する', () => {
    const p = packagesOf('demo/plugin');
    expect(p.releases).toEqual({
      '1.2.3': {
        archiveIntegrity: 'sha384-AAA',
        integrities: [{ target: 'plugin.auf', targetIntegrity: 'sha384-BBB' }],
      },
    });
  });

  it('id やバージョンに __proto__ を使われてもプロトタイプを差し替えられない', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<packages>
  <package>
    <id>__proto__</id>
    <latestVersion>0.1</latestVersion>
    <files>
      <file>a.auf</file>
    </files>
    <releases>
      <release version="__proto__">
        <archiveIntegrity>sha384-CCC</archiveIntegrity>
      </release>
    </releases>
  </package>
</packages>
`;
    const packages = parsePackagesXml(xml);
    // 汚染ではなく通常のエントリとして保持される
    expect(Object.keys(packages)).toEqual(['__proto__']);
    expect(Object.keys(packages['__proto__'].releases ?? {})).toEqual([
      '__proto__',
    ]);
    expect(
      ({} as Record<string, unknown>).polluted,
      'Object.prototype が汚染されていない',
    ).toBeUndefined();
  });

  it('不正な XML は例外を投げる', () => {
    expect(() => parsePackagesXml('<packages><package>')).toThrow();
  });

  it('packages 要素が無い XML は例外を投げる', () => {
    expect(() => parsePackagesXml('<other />')).toThrow('The list is invalid.');
  });
});

/**
 * Returns the fixture package with the given id.
 * @param {string} id - A package id.
 * @returns {import('./parsePackagesXml').PackageInfo} The parsed package.
 */
function packagesOf(id: string) {
  return parsePackagesXml(fixtureXml)[id];
}
