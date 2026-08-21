import { XMLParser, XMLValidator } from 'fast-xml-parser';

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
] as const;

// The shapes below describe the object produced by fast-xml-parser for the
// v2 `packages.xml` format, with the parser options used above:
// - `isArray: () => true` wraps every tag AND attribute in a single-element
//   array (e.g. an attribute `optional="true"` becomes `$optional: ['true']`).
// - `textNodeName: '_'` puts a tag's text content in a plain (unwrapped) `_`
//   property.
// fast-xml-parser itself types `parse()` as `any`, so these are this file's
// own best-effort description of the real shape, not upstream types.

/** A single-element array, as produced by fast-xml-parser for attributes. */
type RawAttr = [string];

/** A `<file>` element with attributes. */
interface RawFileObject {
  _?: string;
  $optional?: RawAttr;
  $installOnly?: RawAttr;
  $directory?: RawAttr;
  $obsolete?: RawAttr;
  $archivePath?: RawAttr;
}

/** The `<files>` element of a package's XML definition. */
interface RawFiles {
  file: (string | RawFileObject)[];
}

/** The `<latestVersion>` element, which may carry a `continuous` attribute. */
interface RawLatestVersionObject {
  _: string;
  $continuous?: RawAttr;
}

/** An `<integrity>` element under `<integrities>`. */
interface RawIntegrity {
  $target: RawAttr;
  _: string;
}

/** A `<release>` element under `<releases>`. */
interface RawRelease {
  $version: RawAttr;
  archiveIntegrity?: [string];
  integrities?: [{ integrity: RawIntegrity[] }];
}

/** The `<releases>` element of a package's XML definition. */
interface RawReleases {
  release: RawRelease[];
}

/** A `<package>` element, as produced by fast-xml-parser. */
interface RawPackage {
  id: [string];
  name?: [string];
  overview?: [string];
  description?: [string];
  developer?: [string];
  originalDeveloper?: [string];
  // The `<dependencies>` element's shape varies (plain text or a nested
  // `<dependency>` list), so it is left as `unknown` and handled dynamically
  // by callers, same as before conversion.
  dependencies?: [unknown];
  pageURL?: [string];
  downloadURL?: [string];
  downloadMirrorURL?: [string];
  directURL?: [string];
  latestVersion?: [string | RawLatestVersionObject];
  detailURL?: [string];
  files?: [RawFiles];
  installer?: [string];
  installArg?: [string];
  releases?: [RawReleases];
}

/** The root of `packages.xml`, as produced by fast-xml-parser. */
interface RawPackagesXml {
  packages?: [{ package: RawPackage[] }];
}

/** A file entry parsed from a package's `<files>` element. */
export interface XmlFile {
  filename: string | null;
  isOptional: boolean;
  isInstallOnly: boolean;
  isDirectory: boolean;
  isObsolete: boolean;
  archivePath: string | null;
}

/** A version entry parsed from a package's `<releases>` element. */
export interface ReleaseInfo {
  archiveIntegrity?: string;
  integrities: { target: string; targetIntegrity: string }[];
}

/**
 * @param {RawPackage} parsedData - A object parsed from XML.
 * @returns {XmlFile[]} An array of files.
 */
function parseFiles(parsedData: RawPackage): XmlFile[] {
  const files: XmlFile[] = [];
  for (const file of parsedData.files[0].file) {
    const tmpFile: XmlFile = {
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
 * A single package parsed from the v2 `packages.xml` format.
 */
export class PackageInfo {
  id?: string;
  name?: string;
  overview?: string;
  description?: string;
  developer?: string;
  originalDeveloper?: string;
  dependencies?: unknown;
  pageURL?: string;
  downloadURL?: string;
  downloadMirrorURL?: string;
  directURL?: string;
  latestVersion?: string;
  isContinuous?: boolean;
  detailURL?: string;
  files?: XmlFile[];
  installer?: string;
  installArg?: string;
  releases?: Record<string, ReleaseInfo>;

  /**
   * Returns the package's information.
   * @param {RawPackage} parsedPackage - An object parsed from XML.
   */
  constructor(parsedPackage: RawPackage) {
    // Assignment goes through an untyped view of `this` because the field
    // being written is only known at runtime (it comes from `defaultKeys`);
    // the properties declared above still give consumers a typed shape.
    const self = this as Record<string, unknown>;
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
          // version はリモート由来のままキーになる。__proto__ のような名前で
          // プロトタイプを差し替えられないよう、継承なしのオブジェクトにする
          this.releases = Object.create(null) as Record<string, ReleaseInfo>;
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
          self[key] = parsedPackage[key][0];
        }
      }
    }
    Object.freeze(this);
  }
}

/** A list of packages keyed by package id. */
export type PackagesList = { [id: string]: PackageInfo };

/**
 * Parses the v2 `packages.xml` data into a list of packages.
 * @param {string} xmlData - The contents of the XML file.
 * @returns {PackagesList} A list of packages keyed by package id.
 */
export function parsePackagesXml(xmlData: string): PackagesList {
  const valid = XMLValidator.validate(xmlData);
  if (valid !== true) throw valid;

  const packagesInfo = parser.parse(xmlData) as RawPackagesXml;
  if (!packagesInfo.packages) throw new Error('The list is invalid.');

  // id はリモート由来のままキーになるため、releases と同じく継承なしにする
  const packages: PackagesList = Object.create(null) as PackagesList;
  for (const packageItem of packagesInfo.packages[0].package) {
    packages[packageItem.id[0]] = new PackageInfo(packageItem);
  }
  return packages;
}
