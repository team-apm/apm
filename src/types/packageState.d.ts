import { Packages } from 'apm-schema';

/**
 * パッケージの定義(info)と、あるインストール先での現在の状態を束ねた型。
 * 旧 PackageItem。version 以降が optional なのは、getPackages(定義 + type
 * のみ)→ getPackagesExtra(installationStatus / version)→
 * getPackagesWithStatus(doNotInstall / detached)の順に段階的に埋まるため。
 */
export type PackageState = {
  id: string;
  info: Packages['packages'][number];
  type: string[];
  version?: string;
  installationStatus?: string;
  detached?: PackageState[];
  doNotInstall?: boolean;
};
