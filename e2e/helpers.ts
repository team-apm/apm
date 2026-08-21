import {
  _electron,
  test as base,
  type ElectronApplication,
  expect,
  type Page,
} from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

const timedOut = Symbol('timedOut');

/**
 * Awaits the promise, giving up after the given time.
 * @param {Promise<T>} promise - The promise to await.
 * @param {number} ms - The time limit in milliseconds.
 * @returns {Promise<T | typeof timedOut>} The result, or timedOut symbol.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | typeof timedOut> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<typeof timedOut>((resolve) => {
        timer = setTimeout(() => resolve(timedOut), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Closes the app, force-killing the process tree if the graceful close does
 * not finish in time.
 * app.close() は「アプリが自発的に終了する」のを無期限に待つため、main
 * プロセスが固まっている(同期ダイアログ表示中・ダウンロード停滞等)と
 * 永遠に返らない。放置すると worker プロセスの終了処理でも同じ graceful
 * close が走って二重にハングするので、ここで時間を区切って必ず殺し切る。
 * @param {ElectronApplication} app - The launched Electron application.
 */
async function closeOrKill(app: ElectronApplication): Promise<void> {
  const proc = app.process();
  const exited = new Promise<void>((resolve) => {
    if (proc.exitCode !== null || proc.signalCode !== null) resolve();
    else proc.once('exit', () => resolve());
  });
  const closed = await withTimeout(
    // kill 後に reject されても unhandled rejection にしない
    app.close().catch((): undefined => undefined),
    15_000,
  );
  if (closed === timedOut) {
    if (process.platform === 'win32') {
      // ChildProcess.kill() は renderer 等の子プロセスまでは殺せないため、
      // Windows はプロセスツリーごと taskkill する
      try {
        execFileSync('taskkill', ['/pid', String(proc.pid), '/t', '/f'], {
          stdio: 'ignore',
        });
      } catch {
        // 競合してすでに終了していた場合は何もしない
      }
    } else {
      proc.kill('SIGKILL');
    }
  }
  await withTimeout(exited, 10_000);
}

type LaunchOptions = {
  /**
   * Initial contents of config.json (electron-store). Omit to start from a
   * clean profile.
   */
  config?: Record<string, unknown>;
};

type Fixtures = {
  /**
   * Registers a teardown function. Registered functions run in LIFO order
   * after the test, even when the test itself times out (テスト本体の
   * try/finally はタイムアウト時に完走しないため、後始末は必ずこちらに
   * 登録する).
   */
  cleanup: (fn: () => void | Promise<void>) => void;
  /**
   * Launches the packaged app with an isolated (temporary) userData
   * directory so that tests never touch the real profile. Closing the app
   * and removing the directory are registered to the cleanup fixture.
   */
  launchApp: (options?: LaunchOptions) => Promise<ElectronApplication>;
};

export const test = base.extend<Fixtures>({
  // Playwright は第 1 引数の分割代入パターンから依存 fixture を検出するため、
  // 依存なしでも {} 以外(_ 等の識別子)は書けない
  // eslint-disable-next-line no-empty-pattern
  cleanup: async ({}, use) => {
    const fns: (() => void | Promise<void>)[] = [];
    await use((fn) => {
      fns.push(fn);
    });
    for (const fn of fns.reverse()) await fn();
  },
  launchApp: async ({ cleanup }, use) => {
    await use(async (options) => {
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
      cleanup(async () => {
        await closeOrKill(app);
        // 強制 kill 直後はファイルロックが残ることがあるためリトライ付き
        rmSync(userDataDir, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200,
        });
      });
      return app;
    });
  },
});

export { expect };

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
