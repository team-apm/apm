import { expect, test } from '@playwright/test';
import { rmSync } from 'node:fs';
import { getMainWindow, launchIsolated } from './helpers';

test('起動して main 窓が開き、パッケージ一覧が描画される', async () => {
  // クリーンな userData で起動し、実データでの初回起動フローを検証する
  const { app, userDataDir } = await launchIsolated();
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
    rmSync(userDataDir, { recursive: true, force: true });
  }
});
