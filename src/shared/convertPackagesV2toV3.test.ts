import { describe, expect, it } from 'vitest';
import { convertPackagesV2toV3 } from './convertPackagesV2toV3';
import { parsePackagesXml } from './parsePackagesXml';

// 「packages.xml → packages.json」変換のテスト。
// パース → 変換のパイプライン全体を通して出力の形を固定する
const fixtureXml = `<?xml version="1.0" encoding="utf-8"?>
<packages>
  <package>
    <id>demo/plugin</id>
    <name>デモプラグイン</name>
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
      <file optional="true">readme.txt</file>
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

describe('convertPackagesV2toV3', () => {
  it('packages.xml のパース結果を v3 の packages.json 形式へ変換する', () => {
    const packagesList = parsePackagesXml(fixtureXml);
    const result = convertPackagesV2toV3(Object.values(packagesList));

    expect(result).toEqual({
      version: 3,
      packages: [
        {
          id: 'demo/plugin',
          name: 'デモプラグイン',
          developer: 'demo-dev',
          dependencies: ['dep/one'],
          pageURL: 'https://example.com/page',
          downloadURLs: [
            'https://example.com/dl.zip',
            'https://example.com/mirror.zip',
          ],
          latestVersion: '1.2.3',
          isContinuous: true,
          files: [
            {
              filename: 'plugin.auf',
              isUninstallOnly: false,
              isInstallOnly: false,
              isDirectory: false,
              isObsolete: false,
              archivePath: null,
            },
            {
              filename: 'readme.txt',
              isUninstallOnly: true,
              isInstallOnly: false,
              isDirectory: false,
              isObsolete: false,
              archivePath: null,
            },
          ],
          releases: [
            {
              version: '1.2.3',
              integrity: {
                archive: 'sha384-AAA',
                file: [{ target: 'plugin.auf', hash: 'sha384-BBB' }],
              },
            },
          ],
        },
        {
          id: 'demo/script',
          name: 'スクリプト',
          downloadURLs: ['https://example.com/s.zip'],
          latestVersion: '0.1',
          files: [
            {
              filename: 'script.anm',
              isUninstallOnly: false,
              isInstallOnly: false,
              isDirectory: false,
              isObsolete: false,
              archivePath: null,
            },
          ],
        },
      ],
    });
  });

  it('isOptional の改名はファイル要素のキーだけに効き、説明文は書き換えない', () => {
    const result = convertPackagesV2toV3([
      {
        id: 'x',
        overview: 'isOptional を説明する文章',
        files: [
          {
            filename: 'readme.txt',
            isOptional: true,
            isInstallOnly: false,
            isDirectory: false,
            isObsolete: false,
            archivePath: null,
          },
        ],
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const converted = result.packages[0] as any;
    expect(converted.overview).toBe('isOptional を説明する文章');
    expect(converted.files[0]).toEqual({
      filename: 'readme.txt',
      isUninstallOnly: true,
      isInstallOnly: false,
      isDirectory: false,
      isObsolete: false,
      archivePath: null,
    });
  });

  it('releases が無いパッケージは downloadURLs の組み立てのみ行う', () => {
    const result = convertPackagesV2toV3([
      { id: 'y', downloadURL: 'https://example.com/y.zip' },
    ]);
    expect(result.packages).toEqual([
      { id: 'y', downloadURLs: ['https://example.com/y.zip'] },
    ]);
  });
});
