import compareVersions from 'compare-versions';

/**
 *  Compare the two given versions.
 *
 * @param {string} firstVersion - First version to compare
 * @param {string} secondVersion - Second version to compare
 * @returns {number} A number representing the version order
 */
function compareVersion(firstVersion, secondVersion) {
  if (firstVersion === secondVersion) return 0;
  const isDate1 = firstVersion.match(/^\d{4}\/\d{2}\/\d{2}$/);
  const isDate2 = secondVersion.match(/^\d{4}\/\d{2}\/\d{2}$/);
  if (isDate1 !== isDate2) return 0;
  if (isDate1 && isDate2) {
    return compareVersions(
      firstVersion.replaceAll('/', '.'),
      secondVersion.replaceAll('/', '.')
    ); // 2022/02/02 -> 2022.02.02
  }

  const toSemver = (v) =>
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

  try {
    return compareVersions(toSemver(firstVersion), toSemver(secondVersion));
  } catch {
    return 0;
  }
}

export { compareVersion };
