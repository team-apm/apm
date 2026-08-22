import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createZip, serveFixtures, ssriOf, writeDataSet } from './fixtures';
import { expect, getMainWindow, test } from './helpers';

test('AviUtl 本体のインストールができる', async ({ cleanup, launchApp }) => {
  // --- フィクスチャと配信サーバ ---
  const workDir = mkdtempSync(path.join(tmpdir(), 'apm-e2e-core-'));
  cleanup(() => rmSync(workDir, { recursive: true, force: true }));
  const fixturesDir = path.join(workDir, 'fixtures');
  const installationPath = path.join(workDir, 'aviutl');
  mkdirSync(installationPath, { recursive: true });

  const { baseUrl, close } = await serveFixtures(fixturesDir);
  cleanup(close);
  const zipPath = path.join(fixturesDir, 'files', 'aviutl.zip');
  createZip(zipPath, path.join(workDir, 'program'), {
    'aviutl.exe': 'dummy aviutl executable for e2e',
  });
  // コアのダウンロードは通常経路と違い integrity 検証があるため、
  // 生成した zip の ssri を release に埋める
  writeDataSet(fixturesDir, {
    aviutlReleases: [
      {
        version: '1.10',
        url: `${baseUrl}/files/aviutl.zip`,
        integrity: { archive: ssriOf(zipPath), file: [] },
      },
    ],
  });

  const app = await launchApp({
    config: {
      dataVersion: '3',
      installationPath: installationPath,
      dataURL: { main: baseUrl, extra: '' },
    },
  });
  const window = await getMainWindow(app);
  // preload の初期化フロー完了を待つ(完了するとインストール先が入る)
  await expect(window.locator('#installation-path')).toHaveValue(
    installationPath,
    {
      timeout: 120_000,
    },
  );

  // バージョン選択ドロップダウンから最新版(1.10)をインストールする
  await window.locator('#install-aviutl').click();
  await window
    .locator('#aviutl-version-select .dropdown-item', { hasText: '1.10' })
    .click();
  await expect(window.locator('#install-aviutl')).toHaveText(
    'インストール完了',
    { timeout: 120_000 },
  );

  // 実ファイルが置かれ、インストール済みバージョンが表示される
  expect(existsSync(path.join(installationPath, 'aviutl.exe'))).toBe(true);
  await expect(window.locator('#aviutl-installed-version')).toContainText(
    'バージョン: 1.10',
  );
});
