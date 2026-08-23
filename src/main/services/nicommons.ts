import { net } from 'electron';
import log from 'electron-log/main';

/**
 * Fetches the work data from the nicommons API.
 * 旧実装(net.request)はエラーハンドラが無く、オフライン時に uncaught
 * exception になるうえ Promise が永遠に解決されなかった。失敗と
 * タイムアウトはすべて false(データなし)へ畳み込む。
 * @param {string} id - The nicommons ID.
 * @returns {Promise<unknown>} The work data, or false if it is not found.
 */
export async function getNicommonsData(id: string): Promise<unknown> {
  try {
    // id はパッケージデータ(リモート由来)の nicommons をそのまま渡した
    // ものなので、'?' や '..' が URL の構文として解釈されないよう通す。
    // 形を正規表現で縛らないのは、公式データが sm 系だけでも nicommons の
    // ID には nc / im / td 等があり、サードパーティのデータを不当に
    // 弾きたくないため
    const response = await net.fetch(
      `https://public-api.commons.nicovideo.jp/v1/works/${encodeURIComponent(id)}?with_meta=1`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (response.status === 404) {
      log.debug('No data are found in nicommons API.');
      return false;
    }
    const data: unknown = await response.json();
    if (data && typeof data === 'object' && 'data' in data) {
      return data.data;
    }
    return false;
  } catch (e) {
    log.error(e);
    return false;
  }
}
