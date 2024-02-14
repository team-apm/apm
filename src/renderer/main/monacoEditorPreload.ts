import { Packages } from 'apm-schema';
import { contextBridge } from 'electron';
import * as modList from '../../lib/modList';
import * as parseJson from '../../lib/parseJson';
import packageMain from './package';

/**
 * ContextBridge for monaco editor
 */
export class EditorContextBridge {
  onLoad: () => Promise<void>;
  instPath: { value: string };

  /**
   * constructor
   */
  constructor() {
    contextBridge.exposeInMainWorld('editor', {
      setOnload: async (event: (packages: Packages['packages']) => void) => {
        this.onLoad = async () => {
          try {
            event(
              await parseJson.getPackages(
                modList.getEditorPackagesDataUrl(this.instPath.value),
              ),
            );
          } catch {
            // nop
          }
        };

        // Callback function is called after both initializations.
        // The order of initialization is indefinite.
        if (this.onLoad && this.instPath) await this.onLoad();
      },
      save: async (packages: Packages['packages']) => {
        await parseJson.setPackages(
          modList.getEditorPackagesDataUrl(this.instPath.value),
          packages,
        );
        await packageMain.checkPackagesList(this.instPath.value);
      },
    });
  }

  /**
   * set instPath
   * @param {{ value: string }} instPath - An installation path.
   * @param {string} instPath.value - An installation path.
   */
  async setInstPath(instPath: { value: string }) {
    this.instPath = instPath;

    // Callback function is called after both initializations.
    // The order of initialization is indefinite.
    if (this.onLoad && this.instPath) await this.onLoad();
  }
}
