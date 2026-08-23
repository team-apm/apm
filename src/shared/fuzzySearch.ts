// list.js の fuzzy-search(diff-match-patch 由来の bitap アルゴリズム)の移植。
// Plugins タブ一覧の React 化で list.js を置き換えるため、検索の挙動を
// 現行と同一に保つ目的で src/utils/fuzzy.js をそのまま TypeScript 化した。

export type FuzzyOptions = {
  location?: number;
  distance?: number;
  threshold?: number;
  /**
   * 1 誤字を許すのに必要な文字数。3 なら 3 文字で 0 誤字、4 文字で 1 誤字。
   * 未指定なら list.js と同じく threshold だけで決まる。
   */
  charsPerError?: number;
};

/**
 * Returns whether the pattern fuzzy-matches the text (bitap algorithm).
 * @param {string} text - The text to search in.
 * @param {string} pattern - The pattern to search for.
 * @param {FuzzyOptions} [options] - Matching options (same as list.js).
 * @returns {boolean} `true` if the pattern matches the text.
 */
export function fuzzyMatch(
  text: string,
  pattern: string,
  options: FuzzyOptions = {},
) {
  const matchLocation = options.location ?? 0;
  const matchDistance = options.distance ?? 100;
  const matchThreshold = options.threshold ?? 0.4;
  // 許容する誤字数の上限。threshold を下げる方法は採れない —
  // scoreThreshold には proximity / distance が乗るので、0 にすると
  // 位置 0 以外の完全一致まで落ちてしまう。bitap のループ上限を直接縛る
  const maxErrors = options.charsPerError
    ? Math.floor(pattern.length / options.charsPerError)
    : pattern.length - 1;

  if (pattern === text) return true; // Exact match
  if (pattern.length > 32) return false; // This algorithm cannot be used

  const loc = matchLocation;
  const alphabet: Record<string, number> = {};
  for (let i = 0; i < pattern.length; i++) {
    alphabet[pattern.charAt(i)] = 0;
  }
  for (let i = 0; i < pattern.length; i++) {
    alphabet[pattern.charAt(i)] |= 1 << (pattern.length - i - 1);
  }

  const bitapScore = (e: number, x: number) => {
    const accuracy = e / pattern.length;
    const proximity = Math.abs(loc - x);
    if (!matchDistance) {
      return proximity ? 1.0 : accuracy;
    }
    return accuracy + proximity / matchDistance;
  };

  let scoreThreshold = matchThreshold;
  let bestLoc = text.indexOf(pattern, loc);
  if (bestLoc !== -1) {
    scoreThreshold = Math.min(bitapScore(0, bestLoc), scoreThreshold);
    bestLoc = text.lastIndexOf(pattern, loc + pattern.length);
    if (bestLoc !== -1) {
      scoreThreshold = Math.min(bitapScore(0, bestLoc), scoreThreshold);
    }
  }

  const matchmask = 1 << (pattern.length - 1);
  bestLoc = -1;

  let binMax = pattern.length + text.length;
  let lastRd: number[] = [];
  for (let d = 0; d < pattern.length && d <= maxErrors; d++) {
    let binMin = 0;
    let binMid = binMax;
    while (binMin < binMid) {
      if (bitapScore(d, loc + binMid) <= scoreThreshold) {
        binMin = binMid;
      } else {
        binMax = binMid;
      }
      binMid = Math.floor((binMax - binMin) / 2 + binMin);
    }
    binMax = binMid;
    let start = Math.max(1, loc - binMid + 1);
    const finish = Math.min(loc + binMid, text.length) + pattern.length;

    const rd: number[] = Array(finish + 2);
    rd[finish + 1] = (1 << d) - 1;
    for (let j = finish; j >= start; j--) {
      const charMatch = alphabet[text.charAt(j - 1)];
      if (d === 0) {
        rd[j] = ((rd[j + 1] << 1) | 1) & charMatch;
      } else {
        rd[j] =
          (((rd[j + 1] << 1) | 1) & charMatch) |
          (((lastRd[j + 1] | lastRd[j]) << 1) | 1) |
          lastRd[j + 1];
      }
      if (rd[j] & matchmask) {
        const score = bitapScore(d, j - 1);
        if (score <= scoreThreshold) {
          scoreThreshold = score;
          bestLoc = j - 1;
          if (bestLoc > loc) {
            start = Math.max(1, 2 * loc - bestLoc);
          } else {
            break;
          }
        }
      }
    }
    if (bitapScore(d + 1, loc) > scoreThreshold) {
      break;
    }
    lastRd = rd;
  }

  return bestLoc >= 0;
}

/**
 * Returns whether the search string matches a row.
 * list.js の multiSearch と同じく、検索文字列を空白で分割してすべての語が
 * どこかの列にマッチする行だけを残す。大文字小文字は区別しない。
 * 列を 2 群に分けているのは、長くて情報密度の低い列(説明文・URL)を
 * 誤字許容で引くと無関係な行まで一致してしまうため。語ごとに
 * 「fuzzy 列のどれか、または部分一致列のどれか」で判定する。
 * @param {string[]} fuzzyValues - Column values matched with typo tolerance.
 * @param {string[]} substringValues - Column values matched by substring only.
 * @param {string} searchString - The search string.
 * @param {FuzzyOptions} [options] - Matching options for the fuzzy columns.
 * @returns {boolean} `true` if every word matches at least one column.
 */
export function matchesSearchFilter(
  fuzzyValues: string[],
  substringValues: string[],
  searchString: string,
  options: FuzzyOptions = {},
) {
  const words = searchString.toLowerCase().replace(/ +$/, '').split(/ +/);
  const lowerFuzzy = fuzzyValues.map((v) => String(v).toLowerCase());
  const lowerSubstring = substringValues.map((v) => String(v).toLowerCase());
  return words.every(
    (word) =>
      lowerFuzzy.some((value) => fuzzyMatch(value, word, options)) ||
      lowerSubstring.some((value) => value.includes(word)),
  );
}
