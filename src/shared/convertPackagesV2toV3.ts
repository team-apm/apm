import type { PackageInfo } from './parsePackagesXml';

/** The v3 `packages.json` data converted from the v2 format. */
export interface PackagesJsonV3 {
  version: 3;
  packages: unknown[];
}

/**
 * Converts packages parsed from the v2 `packages.xml` into the v3
 * `packages.json` format.
 * 旧 migration2to3.byFolder のインライン実装の移植。ただし
 * `isOptional` → `isUninstallOnly` の改名だけはファイル要素のキーに対して
 * 行う(旧実装の JSON 文字列全体への replaceAll は、説明文に isOptional と
 * いう文字列が含まれていると値まで書き換えてしまう)。
 * @param {PackageInfo[]} packages - Packages parsed from `packages.xml`.
 * @returns {PackagesJsonV3} The v3 `packages.json` data.
 */
export function convertPackagesV2toV3(packages: PackageInfo[]): PackagesJsonV3 {
  // 以降のステップが破壊的に書き換えるため、freeze された PackageInfo とは
  // 別の可変オブジェクトへ複製する
  let v3Packages = JSON.parse(JSON.stringify(packages));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  v3Packages = v3Packages.map((p: any) => {
    // isOptional は <file> の属性由来のキー(parsePackagesXml の XmlFile)。
    // 出現箇所が分かっているので文字列置換にはしない。entries を組み直すのは
    // delete + 代入だと改名したキーが末尾へ移り、出力の並びが変わるため
    if (Array.isArray(p.files)) {
      p.files = p.files.map((file: Record<string, unknown>) =>
        Object.fromEntries(
          Object.entries(file).map(([key, value]) =>
            key === 'isOptional' ? ['isUninstallOnly', value] : [key, value],
          ),
        ),
      );
    }
    if (p?.dependencies?.dependency) p.dependencies = p.dependencies.dependency;
    if (p?.releases)
      p.releases = Object.entries(p.releases).map(([k, v]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return { ...(v as any), version: k };
      });
    return p;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  v3Packages = v3Packages.map((p: any) => {
    if (p.releases) {
      for (const release of p.releases) {
        if (release.integrities) {
          release.integrity = { file: release.integrities };
          delete release.integrities;
          for (const file of release.integrity.file) {
            file.hash = file.targetIntegrity;
            delete file.targetIntegrity;
          }
        }
        if (release.archiveIntegrity) {
          release.integrity.archive = release.archiveIntegrity;
          delete release.archiveIntegrity;
        }
      }
    }
    p.downloadURLs = [p.downloadURL];
    delete p.downloadURL;
    if (p.downloadMirrorURL) {
      p.downloadURLs.push(p.downloadMirrorURL);
      delete p.downloadMirrorURL;
    }
    return p;
  });
  return { version: 3, packages: v3Packages };
}
