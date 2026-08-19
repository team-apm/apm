import { _electron, expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { getMainWindow, packagedExecutablePath } from './helpers';

test('起動して main 窓が開き、パッケージ一覧が描画される', async () => {
  const executablePath = packagedExecutablePath();
  expect(
    existsSync(executablePath),
    `パッケージ版が見つからない(先に yarn package を実行する): ${executablePath}`,
  ).toBe(true);

  const app = await _electron.launch({ executablePath });
  try {
    const window = await getMainWindow(app);

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
