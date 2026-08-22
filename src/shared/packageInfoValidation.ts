// tRPC 境界(renderer は非信頼)で packageState.info のセキュリティ不変条件を
// 検証する。apm-schema の JSON Schema 全体を強制しないのは、name の文字数上限の
// ような表示用制約まで強制するとサードパーティ dataURL の緩いデータが
// インストールできなくなるため(dataURL 自由入力の確定方針と衝突する)。
// ここで守るのはパス・コマンド・URL に到達するフィールドだけで、
// 形の細部はサービス層(resolveInside / safeRemove / execFileSync)が二重に守る。

/** Control characters (C0 and DEL) that never appear in legitimate values. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

/**
 * Returns whether the value is a relative path that stays inside its base.
 * @param {string} value - A path from remote package data.
 * @returns {boolean} Whether the path is safe to join under a base folder.
 */
export function isSafeRelativePath(value: string): boolean {
  if (value === '' || CONTROL_CHARS.test(value)) return false;
  // 絶対パス(/ 始まり・\ 始まり・ドライブレター)は基点を無視できてしまう
  if (value.startsWith('/') || value.startsWith('\\')) return false;
  if (/^[A-Za-z]:/.test(value)) return false;
  // 正規化で外へ出る形は resolveInside でも弾けるが、境界では文字列の時点で
  // 「.. セグメントを含む名前」ごと拒否する(正当なデータに現れないため)
  return value.split(/[/\\]/).every((segment) => segment !== '..');
}

/**
 * Returns whether the value is a http(s) URL.
 * @param {string} value - A URL from remote package data.
 * @returns {boolean} Whether the URL uses http or https.
 */
export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

/**
 * Validates the security invariants of a package info object.
 * Throws a TypeError when a field that reaches paths, commands, or URLs
 * has an unsafe value.
 * @param {unknown} info - A package info sent over the tRPC boundary.
 * @returns {Record<string, unknown>} The validated info.
 */
export function validatePackageInfo(info: unknown): Record<string, unknown> {
  if (typeof info !== 'object' || info === null)
    throw new TypeError('info is expected to be an object.');
  const record = info as Record<string, unknown>;

  const { files, installer, installArg, directURL, downloadURLs } = record;

  if (!Array.isArray(files))
    throw new TypeError('info.files is expected to be an array.');
  for (const file of files) {
    if (typeof file !== 'object' || file === null)
      throw new TypeError('info.files entries are expected to be objects.');
    const { filename, archivePath } = file as Record<string, unknown>;
    if (typeof filename !== 'string' || !isSafeRelativePath(filename))
      throw new TypeError(`An unsafe filename was specified. ${filename}`);
    if (
      archivePath !== undefined &&
      (typeof archivePath !== 'string' || !isSafeRelativePath(archivePath))
    )
      throw new TypeError(
        `An unsafe archivePath was specified. ${archivePath}`,
      );
  }

  if (installer !== undefined) {
    // installer は展開ディレクトリ内をファイル名一致で探すのに使う。
    // パス区切りを含む値は探索と一致し得ず、不正指定でしかない
    if (
      typeof installer !== 'string' ||
      installer === '' ||
      installer === '.' ||
      installer === '..' ||
      /[/\\]/.test(installer) ||
      CONTROL_CHARS.test(installer)
    )
      throw new TypeError(`An unsafe installer was specified. ${installer}`);
  }

  if (
    installArg !== undefined &&
    (typeof installArg !== 'string' || CONTROL_CHARS.test(installArg))
  )
    throw new TypeError('An unsafe installArg was specified.');

  if (
    directURL !== undefined &&
    (typeof directURL !== 'string' || !isHttpUrl(directURL))
  )
    throw new TypeError(`A non-http(s) directURL was specified. ${directURL}`);

  if (downloadURLs !== undefined) {
    if (
      !Array.isArray(downloadURLs) ||
      !downloadURLs.every((u) => typeof u === 'string' && isHttpUrl(u))
    )
      throw new TypeError(
        'downloadURLs is expected to be an array of http(s) URLs.',
      );
  }

  return record;
}
