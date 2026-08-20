/** The placeholder in `installArg` replaced with the installation path. */
const INSTALL_PATH_PLACEHOLDER = '$instpath';

/**
 * Splits an `installArg` string into an argument array.
 *
 * 引用符はシェルと同じく引数の区切りを打ち消す用途にのみ使い、トークンからは
 * 取り除く(`/DIR="$instpath"` → `/DIR=<instPath>`)。シェルを介さず
 * execFileSync へ渡すため、メタ文字(`&` `|` `;` など)は展開されず
 * ただの文字として実行ファイルに届く。
 * @param {string} installArg - The raw `installArg` from the package data.
 * @returns {string[]} The tokenized arguments.
 */
function tokenize(installArg: string): string[] {
  const args: string[] = [];
  let current = '';
  let hasToken = false;
  let quote: '"' | "'" | null = null;

  for (const char of installArg) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      // 空文字列の引数("" のみ)も 1 トークンとして残す
      hasToken = true;
      continue;
    }
    if (/\s/.test(char)) {
      if (hasToken || current !== '') {
        args.push(current);
        current = '';
        hasToken = false;
      }
      continue;
    }
    current += char;
    hasToken = true;
  }
  if (hasToken || current !== '') args.push(current);

  return args;
}

/**
 * Builds the argument array passed to a package installer.
 *
 * `$instpath` はトークン化した後に置換するため、インストール先のパスに空白や
 * シェルメタ文字が含まれていても引数の境界は動かない。
 * @param {string | undefined} installArg - The raw `installArg` from the package data.
 * @param {string} instPath - An installation path.
 * @returns {string[]} The arguments for the installer.
 */
export function buildInstallerArgs(
  installArg: string | undefined,
  instPath: string,
): string[] {
  if (!installArg) return [];
  return tokenize(installArg).map((arg) =>
    arg.replaceAll(INSTALL_PATH_PLACEHOLDER, instPath),
  );
}
