import { compareVersions, compare, CompareOperator } from 'compare-versions';

const toSemver = (v: string) =>
  v
    .toLowerCase()
    .replaceAll(' ', '')
    .replaceAll('/', '.') // 2022/02/02 -> 2022.02.02
    .replaceAll(/[^\x20-\x7F]/g, 'z') // v2仮修正-> v2zzz
    .replaceAll('ver.', '')
    .replaceAll('ver', '')
    .replaceAll(/^[vr+]/g, '') // v3 -> 3 and r11 -> 11 and +60 -> 60
    .replaceAll(/[_+,][vr]?/g, '.') // 1_2.0 -> 1.2.0 and 1.0+3 -> 1.0.3 and 1,v3 -> 1.3
    .replaceAll('(', '-')
    .replaceAll(')', '') // 1.0(test) -> 1.0-test
    .replaceAll(/\d[a-z]/g, (m) => m[0] + '-' + m[1]) // 1.0beta -> 1.0-beta
    .replaceAll(/[a-z]\d/g, (m) => m[0] + '.' + m[1]) // rc2 -> rc.2
    .replaceAll(/^\d+\.\d+-/g, (m) => m.slice(0, -1) + '.0-') // 1.0-beta -> 1.0.0-beta
    .replaceAll(/^\d+-/g, (m) => m.slice(0, -1) + '.0.0-'); // 1-beta -> 1.0.0-beta
const isDate = (v: string) => v.match(/^\d{4}\/\d{2}\/\d{2}$/);

/**
 *  Compare the two given versions.
 * @param {string} firstVersion - First version to compare
 * @param {string} secondVersion - Second version to compare
 * @returns {number} A number representing the version order
 */
export function compareVersion(firstVersion: string, secondVersion: string) {
  if (firstVersion === secondVersion) return 0;
  const isDate1 = isDate(firstVersion);
  const isDate2 = isDate(secondVersion);
  if (isDate1 !== isDate2) return 0;
  if (isDate1 && isDate2) {
    return compareVersions(
      firstVersion.replaceAll('/', '.'),
      secondVersion.replaceAll('/', '.'),
    ); // 2022/02/02 -> 2022.02.02
  }
  try {
    return compareVersions(toSemver(firstVersion), toSemver(secondVersion));
  } catch {
    return 0;
  }
}

/**
 *  Compare the two given versions.
 * @param {string} firstVersion - First version to compare
 * @param {string} secondVersion - Second version to compare
 * @param {string} operator - Allowed arithmetic operator to use
 * @returns {boolean} `true` if the comparison between the firstVersion and the secondVersion satisfies the operator, `false` otherwise.
 */
export function compareVersionOp(
  firstVersion: string,
  secondVersion: string,
  operator: string,
) {
  const isDate1 = isDate(firstVersion);
  const isDate2 = isDate(secondVersion);
  if (isDate1 !== isDate2) return false;
  if (isDate1 && isDate2) {
    return compare(
      firstVersion.replaceAll('/', '.'),
      secondVersion.replaceAll('/', '.'),
      operator as CompareOperator,
    ); // 2022/02/02 -> 2022.02.02
  }
  try {
    return compare(
      toSemver(firstVersion),
      toSemver(secondVersion),
      operator as CompareOperator,
    );
  } catch {
    return false;
  }
}
