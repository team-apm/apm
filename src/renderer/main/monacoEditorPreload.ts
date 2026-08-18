import { Packages } from 'apm-schema';
import { contextBridge } from 'electron';
import { trpc } from '../../lib/trpcClient';
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
            // editorPackages.json の読み書きは main プロセス側
            // (src/main/services/packages.ts)へ移設済み
            event(
              (await trpc.packages.getEditorPackages.query(
                this.instPath.value,
              )) as Packages['packages'],
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
        await trpc.packages.setEditorPackages.mutate({
          instPath: this.instPath.value,
          packages,
        });
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
