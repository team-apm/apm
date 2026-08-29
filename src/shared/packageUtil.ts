import type { Packages } from 'apm-schema';
import path from 'node:path';
import { LedgerObject } from '../types/ledger';
import { PackageState } from '../types/packageState';
import { compareVersionOp } from './compareVersion';
import { verifyFilesByCount } from './install';
import { parsePackageType, states } from './packageDisplay';

// 旧 src/renderer/main/packageUtil.ts から electron 非依存の計算部分を移設

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
type aviutlExtention = keyof typeof typeForExtention;

/** Installation state of packages */
// states / parsePackageType は fs 非依存の表示用モジュール
// (src/shared/packageDisplay.ts)へ移設した。既存の import 経路を維持する
export { parsePackageType, states };

/**
 * Detects package types from the extensions of the files.
 * @param {object[]} files - A list of files of the package.
 * @returns {string[]} Detected package types (duplicates removed).
 */
export function detectPackageTypes(
  files: Packages['packages'][number]['files'],
) {
  const types = files.flatMap((f) => {
    const extention = path.extname(f.filename);
    if (extention in typeForExtention) {
      return [typeForExtention[extention as aviutlExtention]];
    } else {
      return [];
    }
  });
  return Array.from(new Set(types));
}

/**
 * Returns a list of files that were manually installed.
 * @param {string[]} files - List of installed files
 * @param {object[]} installedPackages - A list of object from ledger
 * @param {object[]} packages - A list of object parsed from packages.json
 * @returns {string[]} List of manually installed files
 */
export function getManuallyInstalledFiles(
  files: string[],
  installedPackages: LedgerObject['packages'],
  packages: PackageState[],
) {
  let retFiles = [...files];
  for (const packageState of packages) {
    for (const installedId of Object.keys(installedPackages)) {
      if (installedId === packageState.id) {
        for (const file of packageState.info.files) {
          if (!file.isDirectory) {
            retFiles = retFiles.filter((ef) => ef !== file.filename);
          } else {
            // 区切りを含めずに前方一致させると、名前が前方一致するだけの
            // 別エントリまで巻き込む(実データでは oov/GCMZDrops の
            // "GCMZDrops" が oov/PSDToolKit の "GCMZDrops.auf" を消す)。
            // installedFiles は getInstalledFiles が組み立てる '/' 区切りの
            // 相対パスなので、区切りは常に '/'。データ側に "script/ANM_ssd/"
            // のような末尾スラッシュ付きの指定があるため一度落として付け直す。
            const prefix = file.filename.replace(/\/+$/, '') + '/';
            retFiles = retFiles.filter((ef) => !ef.startsWith(prefix));
          }
        }
      }
    }
  }
  return retFiles;
}

/**
 * Returns the installed version or installation status of the package.
 * @param {object} packageState - A Package
 * @param {string[]} installedFiles - List of installed files
 * @param {string[]} manuallyInstalledFiles - List of manually installed files
 * @param {object[]} installedPackages - A list of object from ledger
 * @param {string} installationPath - An installation path
 * @returns {object} Installed version or installation status of the package
 */
export function getInstalledVersionOfPackage(
  packageState: PackageState,
  installedFiles: string[],
  manuallyInstalledFiles: string[],
  installedPackages: LedgerObject['packages'],
  installationPath: string,
) {
  let installationStatus;
  let version;
  let isInstalledPackage = false;
  let isManuallyInstalledPackage = false;
  for (const file of packageState.info.files) {
    if (file.isInstallOnly) continue; // isInstallOnly is not used to determine installation status because the file is often shared by multiple packages.
    if (installedFiles.includes(file.filename)) isInstalledPackage = true;
    if (manuallyInstalledFiles.includes(file.filename))
      isManuallyInstalledPackage = true;
  }
  installationStatus = isManuallyInstalledPackage
    ? states.manuallyInstalled
    : isInstalledPackage
      ? states.otherInstalled // Still an assumption in this line.
      : states.notInstalled;

  for (const [installedId, installedPackage] of Object.entries(
    installedPackages,
  )) {
    if (installedId === packageState.id) {
      if (packageState.info.files.some((file) => file.isObsolete)) {
        // There is no way to determine if a package that contains obsolete files is corrupt.
        installationStatus = states.installed;
        version = installedPackage.version;
      } else {
        // Determine if the package has been installed properly.
        if (verifyFilesByCount(installationPath, packageState.info.files)) {
          installationStatus = states.installed;
          version = installedPackage.version;
        } else {
          installationStatus = states.installedButBroken;
        }
      }
    }
  }

  return [installationStatus, version];
}

/**
 * Computes doNotInstall / detached of the packages from the dependency and
 * conflict information.
 * 旧 getPackagesStatus の計算部分(apm.json の読み出しを除く)と同一の挙動。
 * @param {object[]} _packages - A list of object parsed from packages.json and resolveInstallationStatus()
 * @param {string} aviUtlVer - An installed version of AviUtl.
 * @param {string} exeditVer - An installed version of 拡張編集.
 * @returns {object[]} - packages
 */
export function computePackagesStatus(
  _packages: PackageState[],
  aviUtlVer: string,
  exeditVer: string,
) {
  const packages = [..._packages].map((p) => {
    return { ...p };
  });
  const aviUtlR = /aviutl\d/;
  const exeditR = /exedit\d/;

  const computeInstallable = (id: string): boolean => {
    const thisPackage = packages.filter((p) => p.id === id).find(() => true);
    if (thisPackage) {
      const isDepsInstallable = (): boolean =>
        (thisPackage.info.dependencies ?? []) // [].every((x) => x) :true
          .map((orOfID) =>
            orOfID
              .split('|')
              .map((id2) => isInstallable(id2))
              .some((x) => x),
          )
          .every((x) => x);
      const otherInstalled =
        thisPackage.installationStatus === states.otherInstalled;
      const conflictsInstalled = (): boolean =>
        (thisPackage.info.conflicts ?? []) // [].some((x) => x) :false
          .map((andOfID) =>
            andOfID
              .split('&')
              .map((id2) => isInstalled(id2))
              .every((x) => x),
          )
          .some((x) => x);
      const isConflicted = () => otherInstalled || conflictsInstalled();
      return isDepsInstallable() && !isConflicted();
    } else if (aviUtlR.test(id)) {
      return id === 'aviutl' + aviUtlVer;
    } else if (exeditR.test(id)) {
      return id === 'exedit' + exeditVer;
    } else {
      return false;
    }
  };
  // dependencies はリモート由来(dataURL の packages.json と
  // {installationPath}/packages.json)なので A→B→A や A→A が書かれうる。
  // 評価中の id を弾かないと無限再帰で RangeError になり、
  // getPackagesWithStatus に try/catch が無いためパッケージ一覧が丸ごと
  // 表示できなくなる。
  const evaluating = new Set<string>();
  const isInstallable = (id: string): boolean => {
    // 循環は「導入できない」に倒す。一覧そのものが出なくなるより、
    // その 1 件が導入不可と表示されるほうがユーザーは先へ進める。
    if (evaluating.has(id)) return false;
    evaluating.add(id);
    try {
      return computeInstallable(id);
    } finally {
      evaluating.delete(id);
    }
  };
  const isInstalled = (rawId: string): boolean => {
    const [, id, operator, version] =
      rawId.match(
        /^((?:[A-Za-z0-9]+\/[A-Za-z0-9]+)|(?:aviutl[A-Za-z0-9.]+)|(?:exedit[A-Za-z0-9.]+))(?:(<|<=|=|>=|>)([^<=>&|\n]+))?$/u,
      ) ?? [];
    const thisPackage = packages.filter((p) => p.id === id).find(() => true);
    if (thisPackage) {
      const statusInstalled =
        thisPackage.installationStatus !== states.installedButBroken &&
        thisPackage.installationStatus !== states.notInstalled &&
        thisPackage.installationStatus !== states.otherInstalled;
      const satisfiesVersion =
        operator && thisPackage.version
          ? compareVersionOp(thisPackage.version, version, operator)
          : true;
      return statusInstalled && satisfiesVersion;
    } else if (aviUtlR.test(id)) {
      return id === 'aviutl' + aviUtlVer;
    } else if (exeditR.test(id)) {
      return id === 'exedit' + exeditVer;
    } else {
      return false;
    }
  };
  const missingDeps = (id: string): string[] => {
    const thisPackage = packages.filter((p) => p.id === id).find(() => true);
    if (thisPackage && isInstalled(id)) {
      return (thisPackage.info.dependencies ?? [])
        .filter(
          // If any of these are not installed
          (orOfID) =>
            !orOfID
              .split('|')
              .map((id2) => isInstalled(id2))
              .some((x) => x),
        )
        .flatMap((orOfID): string[] => {
          const candidate = orOfID
            .split('|')
            .filter((id2) => isInstallable(id2))
            .find(() => true);
          return candidate ? [candidate] : [];
        });
    } else return [];
  };

  // doNotInstall の理由のうち「依存が満たせない」ものを取り出す。
  // computeInstallable の isDepsInstallable と同じ式で、false になった
  // グループだけを残す。missingDeps と違って導入済みかどうかを問わないので、
  // まだ入れていないパッケージでも「何が足りないか」が出せる
  const unmetDeps = (id: string): string[] => {
    const thisPackage = packages.filter((p) => p.id === id).find(() => true);
    if (!thisPackage) return [];
    return (thisPackage.info.dependencies ?? []).filter(
      (orOfID) => !orOfID.split('|').some((id2) => isInstallable(id2)),
    );
  };

  // doNotInstall のもう 1 つの理由。computeInstallable の conflictsInstalled と
  // 同じ式で、実際に成立している競合だけを残す
  const activeConflicts = (id: string): string[] => {
    const thisPackage = packages.filter((p) => p.id === id).find(() => true);
    if (!thisPackage) return [];
    return (thisPackage.info.conflicts ?? []).filter((andOfID) =>
      andOfID.split('&').every((id2) => isInstalled(id2)),
    );
  };

  packages.forEach((p) => {
    p.doNotInstall = !isInstallable(p.id);
    p.unmetDependencies = p.doNotInstall ? unmetDeps(p.id) : [];
    p.conflictingWith = p.doNotInstall ? activeConflicts(p.id) : [];
    p.detached = missingDeps(p.id).flatMap((depsID) => {
      const dep = packages.find((pp) => pp.id === depsID);
      return dep ? [dep] : [];
    });
  });
  return packages;
}
