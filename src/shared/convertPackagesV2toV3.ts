import type { PackageInfo } from './parsePackagesXml';

/** The v3 `packages.json` data converted from the v2 format. */
export interface PackagesJsonV3 {
  version: 3;
  packages: unknown[];
}

/**
 * Converts packages parsed from the v2 `packages.xml` into the v3
 * `packages.json` format.
 * 旧 migration2to3.byFolder のインライン実装の忠実な移植。
 * `isOptional` → `isUninstallOnly` の変換は JSON 文字列全体への
 * replaceAll であり、キー以外(説明文等)に isOptional という文字列が
 * 含まれていても置換されるという性質ごと維持している。
 * @param {PackageInfo[]} packages - Packages parsed from `packages.xml`.
 * @returns {PackagesJsonV3} The v3 `packages.json` data.
 */
export function convertPackagesV2toV3(packages: PackageInfo[]): PackagesJsonV3 {
  let v3Packages = JSON.parse(
    JSON.stringify(packages).replaceAll('isOptional', 'isUninstallOnly'),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  v3Packages = v3Packages.map((p: any) => {
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
