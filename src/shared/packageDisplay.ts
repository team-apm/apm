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
