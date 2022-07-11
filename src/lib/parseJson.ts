// import path from 'path';
import { Core, List, Packages } from 'apm-schema';
import fs, { readJSON, writeJson } from 'fs-extra';
import { PackageItem } from '../types/packageItem';
import { getIdDict } from './convertId';

// Functions to be exported

/**
 * Returns a list of core programs.
 *
 * @param {string} coreListPath - A path of Json file.
 * @returns {Core} A list of core programs.
 */
export async function getCore(coreListPath: string): Promise<Core> {
  if (fs.existsSync(coreListPath)) {
    return (await readJSON(coreListPath)) as Core;
  } else {
    throw new Error('The version file does not exist.');
  }
}

/**
 * Returns a list of packages.
 *
 * @param {string} packagesListPath - A path of Json file.
 * @returns {Promise<object>} A list of packages.
 */
export async function getPackages(packagesListPath: string) {
  if (fs.existsSync(packagesListPath)) {
    const packages = ((await readJSON(packagesListPath)) as Packages).packages;

    const convDict = await getIdDict();
    for (const packageItem of packages) {
      // For compatibility with data v1
      if (Object.prototype.hasOwnProperty.call(convDict, packageItem.id)) {
        packageItem.id = convDict[packageItem.id];
      }
    }

    return packages;
  } else {
    throw new Error('The version file does not exist.');
  }
}

/**
 * Write the packages in Json.
 *
 * @param {string} packagesListPath - A path of Json file.
 * @param {object} packages - A list of packages.
 */
async function setPackages(
  packagesListPath: string,
  packages: Packages['packages']
) {
  await writeJson(packagesListPath, { version: 3, packages: packages });
}

/**
 * Add the packages to Json.
 *
 * @param {string} packagesListPath - A path of Json file.
 * @param {object} packageItem - A package.
 */
export async function addPackage(
  packagesListPath: string,
  packageItem: Packages['packages'][number]
) {
  const packages: Packages['packages'] = fs.existsSync(packagesListPath)
    ? (await getPackages(packagesListPath)).filter(
        (p) => p.id !== packageItem.id
      )
    : [];
  packages.push(packageItem);
  await setPackages(packagesListPath, packages);
}

/**
 * Remove the packages in Json.
 *
 * @param {string} packagesListPath - A path of Json file.
 * @param {object} packageItem - A package.
 */
export async function removePackage(
  packagesListPath: string,
  packageItem: PackageItem
) {
  const packages = (await getPackages(packagesListPath)).filter(
    (p) => p.id !== packageItem.id
  );
  if (packages.length > 0) {
    await setPackages(packagesListPath, packages);
  } else {
    fs.unlinkSync(packagesListPath);
  }
}

/**
 * Returns an object which contains mod dates.
 *
 * @param {string} packagesListPath - A path of Json file.
 * @returns {List} An object which contains mod dates.
 */
export async function getMod(packagesListPath: string) {
  if (fs.existsSync(packagesListPath)) {
    return (await readJSON(packagesListPath)) as List;
  } else {
    throw new Error('The version file does not exist.');
  }
}
