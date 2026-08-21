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
    const response = await net.fetch(
      `https://public-api.commons.nicovideo.jp/v1/works/${id}?with_meta=1`,
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
