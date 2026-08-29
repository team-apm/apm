import { expect, getMainWindow, test } from './helpers';

test('起動して main 窓が開き、パッケージ一覧が描画される', async ({
  launchApp,
}) => {
  // クリーンな userData で起動し、実データでの初回起動フローを検証する
  const app = await launchApp();
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

  // 検索欄や操作ボタンを載せたカードがペインに収まり、一覧だけが内側で
  // スクロールする(収まらないと一覧と一緒に画面外へ流れていく)
  const heights = await window.evaluate(() => {
    const pane = document.querySelector('section[role="tabpanel"].active');
    const container = pane?.querySelector('.container-lg');
    return {
      pane: pane ? Math.round(pane.getBoundingClientRect().height) : 0,
      container: container
        ? Math.round(container.getBoundingClientRect().height)
        : 0,
    };
  });
  expect(heights.pane).toBeGreaterThan(0);
  expect(heights.container).toBeLessThanOrEqual(heights.pane);

  expect(
    pageErrors.map((e) => e.message),
    'renderer で uncaught exception が発生していない',
  ).toEqual([]);
});
