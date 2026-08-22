/**
 * データ v1 の旧パッケージ ID から現行 ID への変換辞書(convert.json の中身)。
 */
export type PackageIdDict = { [oldId: string]: string };

/**
 * Converts v1 package ids in the list to the current ids in place.
 * services/packages.ts に 4 箇所重複していた同型ループの一本化。
 * @param {{ id: string }[]} items - Items that have a package id.
 * @param {PackageIdDict} convDict - Dictionary of id relationships.
 */
export function convertV1PackageIds(
  items: { id: string }[],
  convDict: PackageIdDict,
) {
  for (const item of items) {
    // For compatibility with data v1
    if (Object.prototype.hasOwnProperty.call(convDict, item.id)) {
      item.id = convDict[item.id];
    }
  }
}

/**
 * Converts the keys and ids of the apm.json packages object in place.
 * 旧 convertId と同一の挙動 — 変換対象かどうかは旧キー(oldId)で判定するが、
 * 新 ID の解決は packageItem.id を辞書に引く(キーと id が食い違うデータでは
 * 結果も食い違う。これは既存挙動の保存であり、意図的な仕様ではない)。
 * @param {{ [key: string]: { id: string } }} packages - The apm.json packages object.
 * @param {PackageIdDict} convDict - Dictionary of id relationships.
 */
export function convertV1LedgerPackages(
  packages: { [key: string]: { id: string } },
  convDict: PackageIdDict,
) {
  for (const [oldId, packageItem] of Object.entries(packages)) {
    if (Object.prototype.hasOwnProperty.call(convDict, oldId)) {
      const newId = convDict[packageItem.id];
      packages[newId] = packages[oldId];
      delete packages[oldId];
      packages[newId].id = newId;
    }
  }
}
