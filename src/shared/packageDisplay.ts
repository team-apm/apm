// Plugins タブの表示用定数と純関数。React(メインワールド)からも import
// されるため、fs や electron に依存するモジュールを import しないこと

export const states = {
  installed: 'インストール済み',
  installedButBroken: 'インストール済み（未導入ファイルあり）',
  manuallyInstalled: '手動インストール済み',
  otherInstalled: '他バージョンがインストール済み',
  notInstalled: '未インストール',
};

/**
 * Convert type from internal expression to display
 * @param {string[]} packageType - A list of package types
 * @returns {string[]} Parsed package types
 */
export function parsePackageType(packageType: string[]) {
  const result = [];
  for (const type of packageType) {
    switch (type) {
      // plugin
      case 'plugin':
        result.push('入力', '出力', 'フィルター', '色変換', '言語');
        break;
      case 'input':
        result.push('入力');
        break;
      case 'output':
        result.push('出力');
        break;
      case 'filter':
        result.push('フィルター');
        break;
      case 'color':
        result.push('色変換');
        break;
      case 'language':
        result.push('言語');
        break;
      // script
      case 'script':
        result.push(
          'アニメーション効果',
          'カスタムオブジェクト',
          'シーンチェンジ',
          'カメラ制御',
          'トラックバー',
          'スクリプト配布サイト',
        );
        break;
      case 'animation':
        result.push('アニメーション効果');
        break;
      case 'object':
        result.push('カスタムオブジェクト');
        break;
      case 'scene':
        result.push('シーンチェンジ');
        break;
      case 'camera':
        result.push('カメラ制御');
        break;
      case 'track':
        result.push('トラックバー');
        break;
      // script distribution sites
      case 'script-dist':
        result.push('スクリプト配布サイト');
        break;
      default:
        result.push('不明');
        break;
    }
  }
  return result;
}

// 依存 ID は `author/pkg` `aviutl1.10` `exedit0.92` のいずれかで、後ろに
// `>=1.0` のようなバージョン指定が付きうる(packageUtil の isInstalled と
// 同じ形)。表示では指定を落として名前だけを出す
const DEPENDENCY_ID =
  /^((?:[A-Za-z0-9]+\/[A-Za-z0-9]+)|(?:aviutl[A-Za-z0-9.]+)|(?:exedit[A-Za-z0-9.]+))(?:(?:<|<=|=|>=|>)(?:[^<=>&|\n]+))?$/u;

/**
 * Converts a dependency ID into a name shown to the user.
 * @param {string} rawId - A dependency ID, optionally with a version specifier.
 * @param {Function} nameOfPackage - Resolves a package ID to its display name.
 * @returns {string} The name to show.
 */
export function dependencyDisplayName(
  rawId: string,
  nameOfPackage: (id: string) => string | undefined,
): string {
  const id = DEPENDENCY_ID.exec(rawId)?.[1] ?? rawId;
  const name = nameOfPackage(id);
  if (name) return name;
  // aviutl / exedit はパッケージ一覧に無い擬似 ID なので手で組み立てる
  if (id.startsWith('aviutl')) return `AviUtl ${id.slice('aviutl'.length)}`;
  if (id.startsWith('exedit')) return `拡張編集 ${id.slice('exedit'.length)}`;
  return id;
}

/**
 * Converts one entry of `unmetDependencies` into a name shown to the user.
 * @param {string} group - One dependency entry; `a|b` means either satisfies it.
 * @param {Function} nameOfPackage - Resolves a package ID to its display name.
 * @returns {string} The name to show.
 */
export function unmetDependencyLabel(
  group: string,
  nameOfPackage: (id: string) => string | undefined,
): string {
  return group
    .split('|')
    .map((id) => dependencyDisplayName(id, nameOfPackage))
    .join(' または ');
}
