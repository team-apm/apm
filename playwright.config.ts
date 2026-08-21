import { defineConfig } from '@playwright/test';

// E2E はパッケージ版バイナリ(yarn package の成果物)を起動する。
// 先に yarn package を実行しておくこと
export default defineConfig({
  testDir: './e2e',
  // 初回起動はパッケージ一覧のダウンロードを含むため長めに取る
  timeout: 300_000,
  // launch.spec は実データ(CDN)依存で、CI ランナーのネットワーク都合で
  // 散発的に落ちることがあるためリトライを 1 回だけ許す
  retries: process.env.CI ? 1 : 0,
  use: {
    // 既定(0 = 無制限)だと click 等がテストタイムアウトまで待ち続けて
    // 失敗箇所が分からなくなるため、単一操作は有限で打ち切る
    actionTimeout: 60_000,
  },
  // Electron アプリを同時に複数起動しない
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
});
