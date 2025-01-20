import * as fs from 'fs-extra';
import path from 'path';
import * as apmJson from './ApmJson';
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

/**
 * Converts id.
 * @param {string} instPath - An installation path
 * @param {number} modTime - A mod time.
 */
export async function convertId(instPath: string, modTime: number) {
  const packages = (await apmJson.get(instPath, 'packages')) as {
    [key: string]: { id: string };
  };

  const convDict = await getIdDict(true);
  for (const [oldId, packageItem] of Object.entries(packages)) {
    if (Object.prototype.hasOwnProperty.call(convDict, oldId)) {
      const newId = convDict[packageItem.id];
      packages[newId] = packages[oldId];
      delete packages[oldId];
      packages[newId].id = newId;
    }
  }

  await apmJson.set(instPath, 'packages', packages);
  await apmJson.set(instPath, 'convertMod', modTime);
}
