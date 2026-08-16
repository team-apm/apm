import { Packages } from 'apm-schema';

declare global {
  interface Window {
    editor: {
      setOnload: (
        onload: (packages: Packages['packages']) => Promise<void>,
      ) => void;
      save: (packages: Packages['packages']) => Promise<void>;
    };
    coreBridge: {
      getInstallationPath: () => string;
      onProgramInstalled: () => Promise<void>;
    };
  }
}
