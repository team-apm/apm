import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { serveFixtures, writeDataSet } from './fixtures';
import { expect, getMainWindow, test } from './helpers';

test('おすすめプラグイン一覧が起動直後からインストール先の状態を反映する', async ({
  cleanup,
  launchApp,
}) => {
  const workDir = mkdtempSync(path.join(tmpdir(), 'apm-e2e-'));
  cleanup(() => rmSync(workDir, { recursive: true, force: true }));
  const fixturesDir = path.join(workDir, 'fixtures');
  const installationPath = path.join(workDir, 'aviutl');
  mkdirSync(installationPath, { recursive: true });
  // インストール先に実ファイルだけを置く(apm.json は作らない)。
  // インストール先が正しく読めていれば「手動インストール済み」になり、
  // 空のまま問い合わせていれば「未インストール」になる
  writeFileSync(path.join(installationPath, 'batch.auf'), 'dummy');

  const { baseUrl, close } = await serveFixtures(fixturesDir);
  cleanup(close);
  // おすすめ一覧に載るのは directURL を持つパッケージだけ
  writeDataSet(fixturesDir, {
    packages: [
      {
        id: 'e2e/batchPlugin',
        name: 'E2E おすすめプラグイン',
        overview: 'E2E テスト用のおすすめプラグイン',
        description: 'AviUtl タブの一括インストール一覧の検証用。',
        developer: 'apm-e2e',
        pageURL: `${baseUrl}/`,
        downloadURLs: [`${baseUrl}/files/batch.zip`],
        directURL: `${baseUrl}/files/batch.zip`,
        latestVersion: '1.0.0',
        files: [{ filename: 'batch.auf' }],
      },
    ],
  });

  const app = await launchApp({
    config: {
      dataVersion: '3',
      installationPath,
      dataURL: { main: `${baseUrl}/`, extra: '' },
    },
  });
  const window = await getMainWindow(app);
  // 起動フローの完了を待つ(完了するとインストール先が入る)
  await expect(window.locator('#installation-path')).toHaveValue(
    installationPath,
    { timeout: 120_000 },
  );

  // 初期表示の AviUtl タブのまま。タブ切り替えも再取得操作もしない
  const row = window.locator('#batch-install-packages .batch-install-package', {
    hasText: 'E2E おすすめプラグイン',
  });
  await expect(row).toBeVisible({ timeout: 120_000 });
  await expect(row.locator('.installed-version')).toHaveText(
    '手動インストール済み',
    { timeout: 120_000 },
  );
});
