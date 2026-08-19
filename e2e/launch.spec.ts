import { _electron, expect, type Page, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Returns the path of the packaged executable for the current platform.
 * @returns {string} Path of the executable
 */
function packagedExecutablePath(): string {
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

test('起動して main 窓が開き、パッケージ一覧が描画される', async () => {
  const executablePath = packagedExecutablePath();
  expect(
    existsSync(executablePath),
    `パッケージ版が見つからない(先に yarn package を実行する): ${executablePath}`,
  ).toBe(true);

  const app = await _electron.launch({ executablePath });
  try {
    // splash 窓が先に開くため、URL で main 窓を特定して待つ
    const isMainWindow = (page: Page) => page.url().includes('main_window');
    const window =
      app.windows().find(isMainWindow) ??
      (await app.waitForEvent('window', { predicate: isMainWindow }));

    const pageErrors: Error[] = [];
    window.on('pageerror', (error) => pageErrors.push(error));

    await expect(window).toHaveTitle('AviUtl Package Manager');

    // 初期表示は AviUtl タブ(インストール先が表示される)
    await expect(window.locator('#installation-path')).toBeVisible();

    // プラグイン&スクリプトタブへ切り替えると一覧が描画される
    // (初回はパッケージ一覧のダウンロードを含むため長めに待つ)
    await window.getByRole('tab', { name: 'プラグイン&スクリプト' }).click();
    await expect(window.locator('#packages-list li').first()).toBeVisible({
      timeout: 240_000,
    });

    expect(
      pageErrors.map((e) => e.message),
      'renderer で uncaught exception が発生していない',
    ).toEqual([]);
  } finally {
    await app.close();
  }
});
