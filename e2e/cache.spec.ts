import { expect, getMainWindow, test } from './helpers';

test('設定タブでダウンロードキャッシュの使用量を確認できる', async ({
  launchApp,
}) => {
  const app = await launchApp();
  const window = await getMainWindow(app);

  await window.getByRole('tab', { name: '設定' }).click();

  await expect(window.locator('label[for="clear-cache"]')).toHaveText(
    'ダウンロードキャッシュ',
  );

  // 「計算中…」から実際の使用量へ変わる
  await expect(
    window.locator('label[for="clear-cache"] ~ div span').first(),
  ).toContainText('使用中');

  // 隔離した userData で起動するためキャッシュは空。押せる状態にしない
  await expect(window.locator('#clear-cache')).toBeDisabled();
});
