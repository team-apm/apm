import { path7za } from '7zip-bin';
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getMainWindow, launchIsolated } from './helpers';

const MODIFIED = '2026-01-01T00:00:00+09:00';

/**
 * Writes the apm data files (list/core/convert/packages) into the given
 * directory.
 * @param {string} dir - The destination directory.
 * @param {object[]} packages - The contents of packages.json's packages field.
 */
function writeDataFiles(dir: string, packages: object[]) {
  mkdirSync(dir, { recursive: true });
  const write = (name: string, data: unknown) =>
    writeFileSync(path.join(dir, name), JSON.stringify(data));
  write('list.json', {
    core: { path: 'core.json', modified: MODIFIED },
    convert: { path: 'convert.json', modified: MODIFIED },
    packages: [{ path: 'packages.json', modified: MODIFIED }],
    scripts: [],
  });
  write('core.json', {
    version: 3,
    aviutl: {
      latestVersion: '1.10',
      files: [{ filename: 'aviutl.exe' }],
      releases: [],
    },
    exedit: {
      latestVersion: '0.92',
      files: [{ filename: 'exedit.auf' }],
      releases: [],
    },
  });
  write('convert.json', {});
  write('packages.json', { version: 3, packages });
}

/**
 * Writes the fixtures: the initial data set (without the dummy plugin) under
 * /initial, and the main data set (with the dummy plugin) + its archive at
 * the root.
 * @param {string} fixturesDir - The directory served over HTTP.
 * @param {string} workDir - A working directory for intermediate files.
 * @param {string} baseUrl - The base URL of the fixtures server.
 */
function writeFixtures(fixturesDir: string, workDir: string, baseUrl: string) {
  const filesDir = path.join(fixturesDir, 'files');
  mkdirSync(filesDir, { recursive: true });

  // ダミープラグインの zip(アプリ側の展開が 7z なので生成にも同梱の 7za を使う)
  const pluginDir = path.join(workDir, 'plugin');
  mkdirSync(pluginDir, { recursive: true });
  writeFileSync(
    path.join(pluginDir, 'dummy.auf'),
    'dummy aviutl plugin for e2e',
  );
  execFileSync(path7za, [
    'a',
    path.join(filesDir, 'dummy.zip'),
    path.join(pluginDir, '*'),
  ]);

  // 差し替え前のデータ取得先(ダミープラグインを含まない)
  writeDataFiles(path.join(fixturesDir, 'initial'), []);
  // 差し替え後のデータ取得先(ダミープラグインを含む)
  writeDataFiles(fixturesDir, [
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
  ]);
}

test('dataURL の差し替えとパッケージのインストール・アンインストールができる', async () => {
  // --- フィクスチャと配信サーバ ---
  const workDir = mkdtempSync(path.join(tmpdir(), 'apm-e2e-'));
  const fixturesDir = path.join(workDir, 'fixtures');
  const initialInstPath = path.join(workDir, 'aviutl-initial');
  const instPath = path.join(workDir, 'aviutl');
  mkdirSync(initialInstPath, { recursive: true });
  mkdirSync(instPath, { recursive: true });

  const server = createServer((req, res) => {
    const filePath = path.join(
      fixturesDir,
      (req.url ?? '/').replace(/^\//, ''),
    );
    if (!filePath.startsWith(fixturesDir) || !existsSync(filePath)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      'content-type': filePath.endsWith('.zip')
        ? 'application/zip'
        : 'application/json',
    });
    res.end(readFileSync(filePath));
  });
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  writeFixtures(fixturesDir, workDir, baseUrl);

  // 設定済みプロファイルを事前シードして起動する。dataVersion が無いと
  // migration がダイアログを出すため必ず '3' を入れる。初期のデータ取得先も
  // フィクスチャに向け、テスト全体を実ネットワーク非依存にする
  const { app, userDataDir } = await launchIsolated({
    config: {
      dataVersion: '3',
      installationPath: initialInstPath,
      dataURL: { main: `${baseUrl}/initial/`, extra: '' },
    },
  });
  try {
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
    await mockOpenDialog(instPath);
    await window
      .getByRole('button', { name: 'AviUtlインストールフォルダを選択' })
      .click();
    await expect(window.locator('#installation-path')).toHaveValue(instPath, {
      timeout: 120_000,
    });

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
    expect(existsSync(path.join(instPath, 'dummy.auf'))).toBe(true);
    await expect(row).toContainText('インストール済み');

    // アンインストールすると実ファイルが消え、一覧の表示も戻る
    // (インストール後の一覧再取得で選択が外れている場合に備えて再選択する)
    await row.click();
    await window.locator('#uninstall-package').click();
    await expect(window.locator('#uninstall-package')).toHaveText(
      'アンインストール完了',
      { timeout: 120_000 },
    );
    expect(existsSync(path.join(instPath, 'dummy.auf'))).toBe(false);
    await expect(row).not.toContainText('インストール済み');
  } finally {
    await app.close();
    server.close();
    rmSync(userDataDir, { recursive: true, force: true });
    rmSync(workDir, { recursive: true, force: true });
  }
});
