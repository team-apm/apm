// list.js の fuzzy-search(diff-match-patch 由来の bitap アルゴリズム)の移植。
// Plugins タブ一覧の React 化で list.js を置き換えるため、検索の挙動を
// 現行と同一に保つ目的で src/utils/fuzzy.js をそのまま TypeScript 化した。

export type FuzzyOptions = {
  location?: number;
  distance?: number;
  threshold?: number;
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
  for (let d = 0; d < pattern.length; d++) {
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
 * Returns whether the search string fuzzy-matches any of the column values.
 * list.js の multiSearch と同一の挙動: 検索文字列を空白で分割し、すべての
 * 語がいずれかの列にマッチする行だけが残る。大文字小文字は区別しない。
 * @param {string[]} values - The column values of a row.
 * @param {string} searchString - The search string.
 * @param {FuzzyOptions} [options] - Matching options (same as list.js).
 * @returns {boolean} `true` if every word matches at least one column.
 */
export function matchesFuzzyFilter(
  values: string[],
  searchString: string,
  options: FuzzyOptions = {},
) {
  const words = searchString.toLowerCase().replace(/ +$/, '').split(/ +/);
  const lowerValues = values.map((v) => String(v).toLowerCase());
  return words.every((word) =>
    lowerValues.some((value) => fuzzyMatch(value, word, options)),
  );
}
