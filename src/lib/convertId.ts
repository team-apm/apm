import * as fs from 'fs-extra';
import path from 'node:path';
import { download, existsTempFile } from './ipcWrapper';
import * as modList from './modList';

/**
 * Returns the id conversion dictionary.
 * @param {boolean} update - Download the json file.
 * @returns {Promise<object>} Dictionary of id relationships.
 */
export async function getIdDict(
  update = false,
): Promise<{ [key: string]: string }> {
  const dictUrl = await modList.getConvertDataUrl();
  if (update) {
    const convertJson = await download(dictUrl, {
      subDir: 'package',
      keyText: dictUrl,
    });
    return convertJson ? await fs.readJson(convertJson) : {};
  } else {
    const convertJson = await existsTempFile(
      path.join('package', path.basename(dictUrl)),
      dictUrl,
    );
    if (convertJson.exists) {
      return await fs.readJson(convertJson.path);
    } else {
      return {};
    }
  }
}

// convertId は main プロセス側(src/main/services/packages.ts の
// convertPackageIds)へ移設済み。getIdDict は parseJson(データエディタ)が使用中
