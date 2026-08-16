import { Packages } from 'apm-schema';

export declare global {
  interface Window {
    editor: {
      setOnload: (
        onload: (packages: Packages['packages']) => Promise<void>,
      ) => void;
      save: (packages: Packages['packages']) => Promise<void>;
    };
  }
}
