import {
  _electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
 * Launches the packaged app with an isolated (temporary) userData directory
 * so that tests never touch the real profile.
 * @param {object} [options] - Launch options.
 * @param {Record<string, unknown>} [options.config] - Initial contents of
 * config.json (electron-store). Omit to start from a clean profile.
 * @returns {Promise<{app: ElectronApplication, userDataDir: string}>} The
 * launched app and the userData directory (remove it after closing the app).
 */
export async function launchIsolated(options?: {
  config?: Record<string, unknown>;
}): Promise<{ app: ElectronApplication; userDataDir: string }> {
  const executablePath = packagedExecutablePath();
  if (!existsSync(executablePath)) {
    throw new Error(
      `パッケージ版が見つからない(先に yarn package を実行する): ${executablePath}`,
    );
  }
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'apm-e2e-userdata-'));
  if (options?.config) {
    // electron-store の実体は userData/config.json の素の JSON なので、
    // 起動前に書いておくだけで設定済み状態を再現できる
    writeFileSync(
      path.join(userDataDir, 'config.json'),
      JSON.stringify(options.config),
    );
  }
  const app = await _electron.launch({
    executablePath,
    args: [`--user-data-dir=${userDataDir}`],
  });
  return { app, userDataDir };
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
