import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createZip, serveFixtures, writeDataSet } from './fixtures';
import { expect, getMainWindow, test } from './helpers';

/**
 * Writes the fixtures: the initial data set (without the dummy plugin) under
 * /initial, and the main data set (with the dummy plugin) + its archive at
 * the root.
 * @param {string} fixturesDir - The directory served over HTTP.
 * @param {string} workDir - A working directory for intermediate files.
 * @param {string} baseUrl - The base URL of the fixtures server.
 */
function writeFixtures(fixturesDir: string, workDir: string, baseUrl: string) {
  createZip(
    path.join(fixturesDir, 'files', 'dummy.zip'),
    path.join(workDir, 'plugin'),
    { 'dummy.auf': 'dummy aviutl plugin for e2e' },
  );

  // 差し替え前のデータ取得先(ダミープラグインを含まない)
  writeDataSet(path.join(fixturesDir, 'initial'));
  // 差し替え後のデータ取得先(ダミープラグインを含む)
  writeDataSet(fixturesDir, {
    packages: [
      {
        id: 'e2e/dummyPlugin',
        name: 'E2E ダミープラグイン',
        overview: 'E2E テスト用のダミープラグイン',
        description: 'Playwright のインストールフロー検証用。',
        developer: 'apm-e2e',
        pageURL: `${baseUrl}/`,
        downloadURLs: [`${baseUrl}/files/dummy.zip`],
        latestVersion: '1.0.0',
        files: [{ filename: 'dummy.auf' }],
      },
    ],
  });
}

test('dataURL の差し替えとパッケージのインストール・アンインストールができる', async ({
  cleanup,
  launchApp,
}) => {
  // --- フィクスチャと配信サーバ ---
  const workDir = mkdtempSync(path.join(tmpdir(), 'apm-e2e-'));
  cleanup(() => rmSync(workDir, { recursive: true, force: true }));
  const fixturesDir = path.join(workDir, 'fixtures');
  const initialInstPath = path.join(workDir, 'aviutl-initial');
  const installationPath = path.join(workDir, 'aviutl');
  mkdirSync(initialInstPath, { recursive: true });
  mkdirSync(installationPath, { recursive: true });

  const { baseUrl, close } = await serveFixtures(fixturesDir);
  cleanup(close);
  writeFixtures(fixturesDir, workDir, baseUrl);

  // 設定済みプロファイルを事前シードして起動する。dataVersion が無いと
  // migration がダイアログを出すため必ず '3' を入れる。初期のデータ取得先も
  // フィクスチャに向け、テスト全体を実ネットワーク非依存にする
  const app = await launchApp({
    config: {
      dataVersion: '3',
      installationPath: initialInstPath,
      dataURL: { main: `${baseUrl}/initial/`, extra: '' },
    },
  });
  const window = await getMainWindow(app);
  // preload の初期化フロー完了を待つ(完了するとインストール先が入る)
  await expect(window.locator('#installation-path')).toHaveValue(
    initialInstPath,
    { timeout: 120_000 },
  );

  // フォルダ選択のネイティブダイアログはモックして固定のパスを返す
  const mockOpenDialog = (dir: string) =>
    app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = () =>
        Promise.resolve({ canceled: false, filePaths: [filePath] });
    }, dir);

  // インストール先をテスト用フォルダへ変更
  await mockOpenDialog(installationPath);
  await window
    .getByRole('button', { name: 'AviUtlインストールフォルダを選択' })
    .click();
  await expect(window.locator('#installation-path')).toHaveValue(
    installationPath,
    {
      timeout: 120_000,
    },
  );
  // 幅に収まらないパスはホバーで全体が読める
  await expect(window.locator('#installation-path')).toHaveAttribute(
    'title',
    installationPath,
  );

  // 差し替え前のデータにはダミープラグインが存在しない
  await window.getByRole('tab', { name: 'プラグイン&スクリプト' }).click();
  const row = window.locator('#packages-list li', {
    hasText: 'E2E ダミープラグイン',
  });
  await expect(row).toHaveCount(0);

  // データ取得先をダミープラグイン入りのデータへ変更
  await window.getByRole('tab', { name: '設定' }).click();
  await window.locator('#data-url').fill(baseUrl);
  await window.locator('#set-data-url').click();
  await expect(window.locator('#set-data-url')).toHaveText('設定完了', {
    timeout: 60_000,
  });

  // パッケージ一覧を再取得するとダミープラグインが現れる
  await window.locator('#check-packages-list').click();
  await window.getByRole('tab', { name: 'プラグイン&スクリプト' }).click();
  await expect(row).toBeVisible({ timeout: 120_000 });

  // インストール(ダウンロード用ブラウザ窓が zip 直リンクを開き、
  // ユーザー操作なしでダウンロードが完了する)
  await row.click();
  await window.locator('#install-package').click();
  await expect(window.locator('#install-package')).toHaveText(
    'インストール完了',
    { timeout: 120_000 },
  );

  // 実ファイルが置かれ、一覧の表示もインストール済みになる
  expect(existsSync(path.join(installationPath, 'dummy.auf'))).toBe(true);
  await expect(row).toContainText('インストール済み');

  // アンインストールすると実ファイルが消え、一覧の表示も戻る
  // (インストール後の一覧再取得で選択が外れている場合に備えて再選択する)
  await row.click();
  await window.locator('#uninstall-package').click();
  await expect(window.locator('#uninstall-package')).toHaveText(
    'アンインストール完了',
    { timeout: 120_000 },
  );
  expect(existsSync(path.join(installationPath, 'dummy.auf'))).toBe(false);
  await expect(row).not.toContainText('インストール済み');

  // 未インストールのまま押しても、何が起きたのか分かる文言が出る
  // (修正前は何も消していないのに「アンインストール完了」と出ていた)
  await row.click();
  await window.locator('#uninstall-package').click();
  await expect(window.locator('#uninstall-package')).toHaveText(
    'インストールされていません。',
    { timeout: 30_000 },
  );
});
