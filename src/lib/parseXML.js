const path = require('path');
const fs = require('fs-extra');
const { XMLParser, XMLBuilder, XMLValidator } = require('fast-xml-parser');
const { getIdDict } = require('./convertId');

const parser = new XMLParser({
  attributeNamePrefix: '$',
  textNodeName: '_',
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: () => true,
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  suppressBooleanAttributes: false,
});

const defaultKeys = [
  'id',
  'name',
  'overview',
  'description',
  'developer',
  'originalDeveloper',
  'dependencies',
  'pageURL',
  'downloadURL',
  'downloadMirrorURL',
  'directURL',
  'latestVersion',
  'detailURL',
  'files',
  'installer',
  'installArg',
  'releases',
];

const typeForExtention = {
  '.auf': 'filter',
  '.aui': 'input',
  '.auo': 'output',
  '.auc': 'color',
  '.aul': 'language',
  '.anm': 'animation',
  '.obj': 'object',
  '.cam': 'camera',
  '.tra': 'track',
  '.scn': 'scene',
};

/**
 * @param {object} parsedData - A object parsed from XML.
 * @returns {Array} An array of files.
 */
function parseFiles(parsedData) {
  const files = [];
  for (const file of parsedData.files[0].file) {
    const tmpFile = {
      filename: null,
      isOptional: false,
      isDirectory: false,
      archivePath: null,
    };
    if (typeof file === 'string') {
      tmpFile.filename = file;
    } else if (typeof file === 'object') {
      tmpFile.filename = file._;
      if (file.$optional) tmpFile.isOptional = Boolean(file.$optional[0]);
      if (file.$directory) tmpFile.isDirectory = Boolean(file.$directory[0]);
      if (file.$archivePath) tmpFile.archivePath = file.$archivePath[0];
    } else {
      continue;
    }
    Object.freeze(tmpFile);
    files.push(tmpFile);
  }
  return files;
}

/**
 * @param {object} parsedData - An object to parse into XML.
 * @returns {Array} An array of files.
 */
function parseFilesInverse(parsedData) {
  const files = [];
  for (const file of parsedData.files) {
    const ret = { '#text': file.filename };
    if (file.isOptional) ret['@_optional'] = true;
    if (file.isDirectory) ret['@_directory'] = true;
    if (file.archivePath) ret['@_archivePath'] = file.archivePath;
    files.push(ret);
  }
  return files;
}

/**
 *
 */
class CoreInfo {
  /**
   * Returns the core program's information.
   *
   * @param {object} parsedCore - An object parsed from XML.
   */
  constructor(parsedCore) {
    if (parsedCore.files) {
      this.files = parseFiles(parsedCore);
    }
    if (parsedCore.latestVersion) {
      if (typeof parsedCore.latestVersion[0] === 'string')
        this.latestVersion = parsedCore.latestVersion[0];
    }
    if (parsedCore.releases) {
      this.releases = {};
      for (const release of parsedCore.releases[0].release) {
        this.releases[release.$version[0]] = {
          url: release.url[0],
          archiveIntegrity: release?.archiveIntegrity?.[0],
          integrities: release?.integrities
            ? release.integrities[0].integrity.map((integrity) => {
                return {
                  target: integrity.$target[0],
                  targetIntegrity: integrity._,
                };
              })
            : [],
        };
      }
    }
    Object.freeze(this);
  }
}

/**
 *
 */
class PackageInfo {
  /**
   * Returns the package's information.
   *
   * @param {object} parsedPackage - An object parsed from XML.
   */
  constructor(parsedPackage) {
    for (const key of defaultKeys) {
      if (parsedPackage[key]) {
        if (key === 'files') {
          this.files = parseFiles(parsedPackage);
        } else if (key === 'latestVersion') {
          const tmpObj = parsedPackage[key][0];
          if (typeof tmpObj === 'string') {
            this[key] = tmpObj;
          } else if (typeof tmpObj === 'object') {
            this[key] = tmpObj._;
            if (tmpObj.$continuous)
              this.isContinuous = Boolean(tmpObj.$continuous[0]);
          }
        } else if (key === 'releases') {
          this.releases = {};
          for (const release of parsedPackage[key][0].release) {
            this.releases[release.$version[0]] = {
              archiveIntegrity: release?.archiveIntegrity?.[0],
              integrities: release?.integrities
                ? release.integrities[0].integrity.map((integrity) => {
                    return {
                      target: integrity.$target[0],
                      targetIntegrity: integrity._,
                    };
                  })
                : [],
            };
          }
        } else {
          this[key] = parsedPackage[key][0];
        }
      }
    }
    const types = this.files.flatMap((f) => {
      const extention = path.extname(f.filename);
      if (extention in typeForExtention) {
        return [typeForExtention[extention]];
      } else {
        return [];
      }
    });
    this.type = [...new Set(types)];
    Object.freeze(this);
  }

  /**
   *
   * @param {object} packageItem - An object to be parsed into xml
   * @returns {object} package item ready to parse.
   */
  static inverse(packageItem) {
    const newPackageItem = {};
    for (const key of defaultKeys) {
      if (packageItem[key]) {
        if (key === 'files') {
          newPackageItem.files = { file: parseFilesInverse(packageItem) };
        } else if (key === 'latestVersion') {
          const tmpItem = { '#text': packageItem[key] };
          if (packageItem.isContinuous) tmpItem['@_continuous'] = true;
          newPackageItem[key] = tmpItem;
        } else if (key === 'releases') {
          newPackageItem.releases = {
            release: Object.entries(packageItem[key]).map(([id, release]) => {
              return {
                '@_version': id,
                archiveIntegrity: release?.archiveIntegrity,
                integrities: release?.integrities
                  ? {
                      integrity: release.integrities.map((i) => {
                        return {
                          '@_target': i.target,
                          '#text': i.targetIntegrity,
                        };
                      }),
                    }
                  : undefined,
              };
            }),
          };
        } else {
          newPackageItem[key] = packageItem[key];
        }
      }
    }
    return newPackageItem;
  }
}

/**
 * An object which contains core list.
 */
class CoreList extends Object {
  /**
   *
   * @param {string} xmlPath - The path of the XML file.
   * @returns {CoreList} A list of core programs.
   */
  constructor(xmlPath) {
    super();
    const xmlData = fs.readFileSync(xmlPath, 'utf-8');
    const valid = XMLValidator.validate(xmlData);
    if (valid === true) {
      const coreInfo = parser.parse(xmlData);
      if (coreInfo.core) {
        for (const program of ['aviutl', 'exedit']) {
          this[program] = new CoreInfo(coreInfo.core[0][program][0]);
        }
      } else {
        throw new Error('The list is invalid.');
      }
    } else {
      throw valid;
    }
  }
}

/**
 * An object which contains packages list.
 */
class PackagesList extends Object {
  /**
   *
   * @param {string} xmlPath - The path of the XML file.
   * @returns {PackagesList} A list of packages.
   */
  constructor(xmlPath) {
    super();
    const xmlData = fs.readFileSync(xmlPath, 'utf-8');
    const valid = XMLValidator.validate(xmlData);
    if (valid === true) {
      const packagesInfo = parser.parse(xmlData);
      if (packagesInfo.packages) {
        for (const packageItem of packagesInfo.packages[0].package) {
          this[packageItem.id[0]] = new PackageInfo(packageItem);
        }
      } else {
        throw new Error('The list is invalid.');
      }
    } else {
      throw valid;
    }
  }

  /**
   *
   * @param {string} xmlPath - The path of the XML file.
   * @param {object} packages - A path of xml file.
   */
  static write(xmlPath, packages) {
    const xmlObject = [];
    for (const packageItem of packages) {
      xmlObject.push(PackageInfo.inverse(packageItem));
    }
    const innerText = builder
      .build({ packages: { package: xmlObject } })
      .trim()
      .replaceAll(/^(\s+)/gm, (str) => '\t'.repeat(Math.floor(str.length / 2)));
    fs.writeFileSync(xmlPath, innerText);
  }
}

/**
 * An object which contains mod dates.
 */
class ModInfo extends Object {
  /**
   *
   * @param {string} xmlPath - The path of the XML file.
   * @returns {ModInfo} An object which contains mod dates.
   */
  constructor(xmlPath) {
    super();
    const xmlData = fs.readFileSync(xmlPath, 'utf-8');
    const valid = XMLValidator.validate(xmlData);
    if (valid === true) {
      const modInfo = parser.parse(xmlData);
      if (modInfo.mod) {
        for (const filename of ['core', 'packages']) {
          this[filename] = new Date(modInfo.mod[0][filename][0]);
        }
        if (modInfo.mod[0].convert)
          this.convert = new Date(modInfo.mod[0].convert[0]);
        if (modInfo.mod[0].scripts)
          this.scripts = new Date(modInfo.mod[0].scripts[0]);
      } else {
        throw new Error('The list is invalid.');
      }
    } else {
      throw valid;
    }
  }
}

// Functions to be exported

/**
 * Returns a list of core programs.
 *
 * @param {string} coreListPath - A path of xml file.
 * @returns {CoreList} A list of core programs.
 */
function getCore(coreListPath) {
  if (fs.existsSync(coreListPath)) {
    return new CoreList(coreListPath);
  } else {
    throw new Error('The version file does not exist.');
  }
}

/**
 * Returns a list of packages.
 *
 * @param {string} packagesListPath - A path of xml file.
 * @returns {Promise<PackagesList>} A list of packages.
 */
async function getPackages(packagesListPath) {
  if (fs.existsSync(packagesListPath)) {
    const packages = new PackagesList(packagesListPath);

    // For compatibility with data v1
    const convDict = await getIdDict();
    for (const [oldId, package] of Object.entries(packages)) {
      if (Object.prototype.hasOwnProperty.call(convDict, oldId)) {
        const newId = convDict[package.id];
        packages[newId] = packages[oldId];
        delete packages[oldId];
        packages[newId].id = newId;
      }
    }

    return packages;
  } else {
    throw new Error('The version file does not exist.');
  }
}

/**
 * Write the packages in XML.
 *
 * @param {string} packagesListPath - A path of xml file.
 * @param {object} packages - A list of packages.
 */
function setPackages(packagesListPath, packages) {
  PackagesList.write(packagesListPath, packages);
}

/**
 * Add the packages to XML.
 *
 * @param {string} packagesListPath - A path of xml file.
 * @param {object} packageItem - A package.
 */
async function addPackage(packagesListPath, packageItem) {
  let packages = [];
  if (fs.existsSync(packagesListPath)) {
    packages = Object.values(await getPackages(packagesListPath)).filter(
      (p) => p.id !== packageItem.id
    );
  }
  packages.push(packageItem);
  setPackages(packagesListPath, packages);
}

/**
 * Remove the packages in XML.
 *
 * @param {string} packagesListPath - A path of xml file.
 * @param {object} packageItem - A package.
 */
async function removePackage(packagesListPath, packageItem) {
  const packages = Object.values(await getPackages(packagesListPath)).filter(
    (p) => p.id !== packageItem.id
  );
  if (packages.length > 0) {
    setPackages(packagesListPath, packages);
  } else {
    fs.unlinkSync(packagesListPath);
  }
}

/**
 * Returns an object which contains mod dates.
 *
 * @param {string} packagesListPath - A path of xml file.
 * @returns {ModInfo} An object which contains mod dates.
 */
function getMod(packagesListPath) {
  if (fs.existsSync(packagesListPath)) {
    return new ModInfo(packagesListPath);
  } else {
    throw new Error('The version file does not exist.');
  }
}

module.exports = {
  getCore,
  getPackages,
  addPackage,
  removePackage,
  getMod,
};
