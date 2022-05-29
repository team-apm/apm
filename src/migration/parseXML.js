import { XMLParser, XMLValidator } from 'fast-xml-parser';
import fs from 'fs-extra';

const parser = new XMLParser({
  attributeNamePrefix: '$',
  textNodeName: '_',
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: () => true,
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
      isInstallOnly: false,
      isDirectory: false,
      isObsolete: false,
      archivePath: null,
    };
    if (typeof file === 'string') {
      tmpFile.filename = file;
    } else if (typeof file === 'object') {
      tmpFile.filename = file._;
      if (file.$optional) tmpFile.isOptional = Boolean(file.$optional[0]);
      if (file.$installOnly)
        tmpFile.isInstallOnly = Boolean(file.$installOnly[0]);
      if (file.$directory) tmpFile.isDirectory = Boolean(file.$directory[0]);
      if (file.$obsolete) tmpFile.isObsolete = Boolean(file.$obsolete[0]);
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
    Object.freeze(this);
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
    return packages;
  } else {
    throw new Error('The version file does not exist.');
  }
}

const parseXML = {
  getPackages,
};
export default parseXML;
