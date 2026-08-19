import { defineConfig } from '@playwright/test';

// E2E はパッケージ版バイナリ(yarn package の成果物)を起動する。
// 先に yarn package を実行しておくこと
export default defineConfig({
  testDir: './e2e',
  // 初回起動はパッケージ一覧のダウンロードを含むため長めに取る
  timeout: 300_000,
  // Electron アプリを同時に複数起動しない
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
});
