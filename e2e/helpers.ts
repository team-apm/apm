import type { ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';

/**
 * Returns the path of the packaged executable for the current platform.
 * @returns {string} Path of the executable
 */
export function packagedExecutablePath(): string {
  const outDir = path.join(
    __dirname,
    '..',
    'out',
    `AviUtl Package Manager-${process.platform}-${process.arch}`,
  );
  if (process.platform === 'darwin')
    return path.join(
      outDir,
      'AviUtl Package Manager.app',
      'Contents',
      'MacOS',
      'apm',
    );
  if (process.platform === 'win32') return path.join(outDir, 'apm.exe');
  return path.join(outDir, 'apm');
}

/**
 * Returns the main window, waiting for it if it has not opened yet.
 * splash 窓が先に開くため、URL で main 窓を特定する。
 * @param {ElectronApplication} app - The launched Electron application.
 * @returns {Promise<Page>} The main window.
 */
export async function getMainWindow(app: ElectronApplication): Promise<Page> {
  const isMainWindow = (page: Page) => page.url().includes('main_window');
  return (
    app.windows().find(isMainWindow) ??
    (await app.waitForEvent('window', { predicate: isMainWindow }))
  );
}
