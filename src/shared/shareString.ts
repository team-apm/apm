import { compareVersion } from './compareVersion';
import { programs, programsDisp } from './programs';

// 共有文字列(sharePackages で生成し検索欄に貼り付ける文字列)のデータ形式
// バージョン。形式を変えたら上げる
export const shareStringVersion = '1.0';

// Variation Selectors for text (U+FE0E) or color (U+FE0F) are added to 🍎, 🎞 and 🎬.
export const shareStringRegex =
  /^.*🍎[\u{fe0e}\u{fe0f}]?([A-Za-z0-9.]+):([A-Za-z0-9.]+),🎞[\u{fe0e}\u{fe0f}]?([A-Za-z0-9.]+),🎬[\u{fe0e}\u{fe0f}]?([A-Za-z0-9.]+)((,[A-Za-z0-9]+\/[A-Za-z0-9]+)*)$/u;

export type ShareString = {
  share: string;
  apm: string;
  aviutl: string;
  exedit: string;
  packages: string[];
};

/**
 * Parses a share string pasted into the search box.
 * 旧 package.ts の searchFunction と同じく小文字化してから解析する。
 * @param {string} searchString - The string pasted into the search box.
 * @returns {ShareString | null} The parsed share string, or null if not a share string.
 */
export function parseShareString(searchString: string): ShareString | null {
  const matched = searchString.toLowerCase().match(shareStringRegex);
  if (!matched) return null;
  return {
    share: matched[1],
    apm: matched[2],
    aviutl: matched[3],
    exedit: matched[4],
    packages: matched[5].split(',').slice(1),
  };
}

/**
 * Returns the alert messages for a pasted share string.
 * 旧 package.ts の searchFunction のアラート生成部分と同一の挙動。
 * @param {ShareString} parsed - The parsed share string.
 * @param {Partial<Record<'aviutl' | 'exedit', string>>} coreVersions - The installed core versions from apm.json.
 * @returns {string[]} Alert messages to show above the list.
 */
export function computeShareStringAlerts(
  parsed: ShareString,
  coreVersions: Partial<Record<'aviutl' | 'exedit', string>>,
) {
  const alertStrings: string[] = [];
  if (compareVersion(shareStringVersion, parsed.share) < 0)
    alertStrings.push(
      '新しいバージョンのapmに対応したデータです。正しく読み込むためにapmの更新が必要な場合があります。',
    );
  for (const program of programs) {
    // apm.json に記録がない場合は undefined のまま比較して NaN(確認不能)に
    // 落とす(旧実装と同一の挙動)
    const currentVersion = coreVersions[program] as string;
    const comparison = compareVersion(currentVersion, parsed[program]);
    if (Number.isNaN(comparison))
      alertStrings.push(
        `${programsDisp[program]} ${parsed[program]} 用のデータです。使用中の ${programsDisp[program]} ${currentVersion} と互換性があるか確認できませんでした。`,
      );
    else if (comparison !== 0)
      alertStrings.push(
        `${programsDisp[program]} ${parsed[program]} 用のデータです。使用中の ${programsDisp[program]} ${currentVersion} には非対応の場合があります。`,
      );
  }
  return alertStrings;
}
