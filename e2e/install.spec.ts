import { path7za } from '7zip-bin';
import { _electron, expect, test } from '@playwright/test';
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
import { getMainWindow, packagedExecutablePath } from './helpers';

const MODIFIED = '2026-01-01T00:00:00+09:00';

/**
 * Writes the apm data files (list/core/convert/packages) and a dummy plugin
 * archive into the fixtures directory.
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

  const write = (name: string, data: unknown) =>
    writeFileSync(path.join(fixturesDir, name), JSON.stringify(data));
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
  write('packages.json', {
    version: 3,
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

test('dataURL の差し替えとパッケージのインストールができる', async () => {
  const executablePath = packagedExecutablePath();
  expect(
    existsSync(executablePath),
    `パッケージ版が見つからない(先に yarn package を実行する): ${executablePath}`,
  ).toBe(true);

  // --- フィクスチャと配信サーバ ---
  const workDir = mkdtempSync(path.join(tmpdir(), 'apm-e2e-'));
  const fixturesDir = path.join(workDir, 'fixtures');
  const instPath = path.join(workDir, 'aviutl');
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

  const app = await _electron.launch({ executablePath });
  try {
    const window = await getMainWindow(app);
    // preload の初期化フロー完了を待つ(完了するとインストール先の既定値が
    // 入る。クリーン環境の初回起動はダウンロードを含むため長めに待つ)
    await expect(window.locator('#installation-path')).not.toHaveValue('', {
      timeout: 120_000,
    });

    // ローカル実行では実プロファイルを使うため、元の設定を控えて最後に戻す
    const originalInstPath = await window
      .locator('#installation-path')
      .inputValue();
    await window.getByRole('tab', { name: '設定' }).click();
    const originalDataUrl = await window.locator('#data-url').inputValue();

    // フォルダ選択のネイティブダイアログはモックして固定のパスを返す
    const mockOpenDialog = (dir: string) =>
      app.evaluate(({ dialog }, filePath) => {
        dialog.showOpenDialog = () =>
          Promise.resolve({ canceled: false, filePaths: [filePath] });
      }, dir);

    try {
      // インストール先をテスト用フォルダへ変更
      await mockOpenDialog(instPath);
      await window.getByRole('tab', { name: 'AviUtl' }).click();
      await window
        .getByRole('button', { name: 'AviUtlインストールフォルダを選択' })
        .click();
      // インストール先変更に伴う再取得(初回はダウンロード込み)を待つ
      await expect(window.locator('#installation-path')).toHaveValue(instPath, {
        timeout: 120_000,
      });

      // データ取得先をフィクスチャサーバへ変更
      await window.getByRole('tab', { name: '設定' }).click();
      await window.locator('#data-url').fill(baseUrl);
      await window.locator('#set-data-url').click();
      await expect(window.locator('#set-data-url')).toHaveText('設定完了', {
        timeout: 60_000,
      });

      // パッケージ一覧を再取得するとダミープラグインが現れる
      await window.locator('#check-packages-list').click();
      await window.getByRole('tab', { name: 'プラグイン&スクリプト' }).click();
      const row = window.locator('#packages-list li', {
        hasText: 'E2E ダミープラグイン',
      });
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
    } finally {
      // 実プロファイルの設定をベストエフォートで元に戻す
      await window.getByRole('tab', { name: '設定' }).click();
      await window.locator('#data-url').fill(originalDataUrl);
      await window.locator('#set-data-url').click();
      await expect(window.locator('#set-data-url')).toHaveText('設定完了', {
        timeout: 60_000,
      });
      if (originalInstPath) {
        await mockOpenDialog(originalInstPath);
        await window.getByRole('tab', { name: 'AviUtl' }).click();
        await window
          .getByRole('button', { name: 'AviUtlインストールフォルダを選択' })
          .click();
        await expect(window.locator('#installation-path')).toHaveValue(
          originalInstPath,
          { timeout: 120_000 },
        );
      }
    }
  } finally {
    await app.close();
    server.close();
    rmSync(workDir, { recursive: true, force: true });
  }
});
