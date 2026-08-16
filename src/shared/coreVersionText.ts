import { compareVersion } from './compareVersion';

/**
 * Returns the description appended to an installed version.
 * 比較不能(NaN)なら空文字、最新版より古ければ最新版の案内、
 * それ以外は rc を含むかどうかでテスト版/最新版の表記を返す。
 * @param {string} installedVersion - The installed version.
 * @param {string} latestVersion - The latest version.
 * @returns {string} The description.
 */
export function installedVersionDescription(
  installedVersion: string,
  latestVersion: string,
) {
  const versionComparison = compareVersion(installedVersion, latestVersion);
  return Number.isNaN(versionComparison)
    ? ''
    : versionComparison === -1
      ? ` （最新版: ${latestVersion}）`
      : installedVersion.includes('rc')
        ? '（テスト版）'
        : ' （最新版）';
}

/**
 * Returns the text displayed as the installed version of a program.
 * @param {string | null} installedVersion - The installed version, or `null` if apm.json does not record one.
 * @param {string} latestVersion - The latest version.
 * @param {boolean} filesVerified - Whether all the program files exist.
 * @returns {string} The display text.
 */
export function installedVersionText(
  installedVersion: string | null,
  latestVersion: string,
  filesVerified: boolean,
) {
  if (installedVersion === null) {
    return filesVerified ? '手動インストール済み' : '未インストール';
  }
  const description = installedVersionDescription(
    installedVersion,
    latestVersion,
  );
  return filesVerified
    ? 'バージョン: ' + installedVersion + description
    : 'バージョン: ' +
        installedVersion +
        description +
        '（未導入ファイルあり）';
}

/**
 * Returns the label of a release shown in the version select.
 * @param {string} version - The version of the release.
 * @param {string} latestVersion - The latest version.
 * @returns {string} The label.
 */
export function releaseLabel(version: string, latestVersion: string) {
  return (
    version +
    (version.includes('rc') ? '（テスト版）' : '') +
    (version === latestVersion ? '（最新版）' : '')
  );
}
