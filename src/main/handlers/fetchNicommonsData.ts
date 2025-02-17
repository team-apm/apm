import { net } from 'electron';
import log from 'electron-log';

/**
 * Fetches data from the Nicommons API for a given work ID.
 * @param {string} id - The ID of the work to fetch data for.
 * @returns {Promise<any>} A promise that resolves to the data of the work if found, or `false` if no data is found or an error occurs.
 */
function fetchNicommonsData(id: string) {
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

export default fetchNicommonsData;
