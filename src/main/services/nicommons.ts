import { net } from 'electron';
import log from 'electron-log/main';

/**
 * Fetches the work data from the nicommons API.
 * @param {string} id - The nicommons ID.
 * @returns {Promise<unknown>} The work data, or false if it is not found.
 */
export function getNicommonsData(id: string) {
  const request = net.request(
    `https://public-api.commons.nicovideo.jp/v1/works/${id}?with_meta=1`,
  );
  return new Promise((resolve) => {
    request.on('response', (response) => {
      if (response.statusCode === 404) {
        log.debug('No data are found in nicommons API.');
        resolve(false);
      } else {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          try {
            const data = JSON.parse(body);
            if ('data' in data) {
              resolve(data.data);
            } else {
              resolve(false);
            }
          } catch (e) {
            log.error(e);
            resolve(false);
          }
        });
      }
    });
    request.end();
  });
}
