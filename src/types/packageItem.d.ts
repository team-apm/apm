import { Packages } from 'apm-schema';

export type PackageItem = {
  id: string;
  info: Packages['packages'][number];
  type?: string[];
  version?: string;
  statusInformation?: string;
  installationStatus?: string;
  detached?: PackageItem[];
  doNotInstall?: boolean;
};
