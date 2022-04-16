// import path from 'path';
import fs, { readJSON } from 'fs-extra';
// import { getIdDict } from '../renderer/main/lib/convertId';
// import { compareVersion } from './compareVersion';
import { Core } from 'apm-schema';

// Functions to be exported

/**
 * Returns a list of core programs.
 *
 * @param {string} coreListPath - A path of xml file.
 * @returns {Core} A list of core programs.
 */
async function getCore(coreListPath: string): Promise<Core> {
  if (fs.existsSync(coreListPath)) {
    return (await readJSON(coreListPath)) as Core;
  } else {
    throw new Error('The version file does not exist.');
  }
}

// /**
//  * Returns a list of packages.
//  *
//  * @param {string} packagesListPath - A path of xml file.
//  * @returns {Promise<PackagesList>} A list of packages.
//  */
// async function getPackages(packagesListPath) {
//   if (fs.existsSync(packagesListPath)) {
//     const packages = new PackagesList(packagesListPath);

//     // For compatibility with data v1
//     const convDict = await getIdDict();
//     for (const [oldId, packageItem] of Object.entries(packages)) {
//       if (Object.prototype.hasOwnProperty.call(convDict, oldId)) {
//         const newId = convDict[packageItem.id];
//         packages[newId] = packages[oldId];
//         delete packages[oldId];
//         packages[newId].id = newId;
//       }
//     }

//     return packages;
//   } else {
//     throw new Error('The version file does not exist.');
//   }
// }

// /**
//  * Write the packages in XML.
//  *
//  * @param {string} packagesListPath - A path of xml file.
//  * @param {object} packages - A list of packages.
//  */
// function setPackages(packagesListPath, packages) {
//   PackagesList.write(packagesListPath, packages);
// }

// /**
//  * Add the packages to XML.
//  *
//  * @param {string} packagesListPath - A path of xml file.
//  * @param {object} packageItem - A package.
//  */
// async function addPackage(packagesListPath, packageItem) {
//   let packages = [];
//   if (fs.existsSync(packagesListPath)) {
//     packages = Object.values(await getPackages(packagesListPath)).filter(
//       (p) => p.id !== packageItem.id
//     );
//   }
//   packages.push(packageItem);
//   setPackages(packagesListPath, packages);
// }

// /**
//  * Remove the packages in XML.
//  *
//  * @param {string} packagesListPath - A path of xml file.
//  * @param {object} packageItem - A package.
//  */
// async function removePackage(packagesListPath, packageItem) {
//   const packages = Object.values(await getPackages(packagesListPath)).filter(
//     (p) => p.id !== packageItem.id
//   );
//   if (packages.length > 0) {
//     setPackages(packagesListPath, packages);
//   } else {
//     fs.unlinkSync(packagesListPath);
//   }
// }

// /**
//  * Returns an object which contains mod dates.
//  *
//  * @param {string} packagesListPath - A path of xml file.
//  * @returns {ModInfo} An object which contains mod dates.
//  */
// function getMod(packagesListPath) {
//   if (fs.existsSync(packagesListPath)) {
//     return new ModInfo(packagesListPath);
//   } else {
//     throw new Error('The version file does not exist.');
//   }
// }

const parseJson = {
  getCore,
  // getPackages,
  // addPackage,
  // removePackage,
  // getMod,
};
export default parseJson;
