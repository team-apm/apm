import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { serveFixtures, writeDataSet } from './fixtures';
import { expect, getMainWindow, test } from './helpers';

/**
 * Builds a package entry for the fixture data set.
 * @param {string} id - The package id.
 * @param {string} name - The display name.
 * @param {string} baseUrl - The base URL of the fixtures server.
 * @returns {object} The package entry.
 */
function pkg(id: string, name: string, baseUrl: string) {
  return {
    id,
    name,
    overview: 'E2E テスト用',
    description: 'Playwright の検索フロー検証用。',
    developer: 'apm-e2e',
    // 検索の巻き込みを再現するため実在しない https の URL を使う
    // (表示と検索にしか使われないので到達性は要らない)
    pageURL: `https://example.com/${id}`,
    downloadURLs: [`${baseUrl}/files/dummy.zip`],
    latestVersion: '1.0.0',
    files: [{ filename: `${id.split('/')[1]}.auf` }],
  };
}

test('検索が 3 文字の語で無関係なパッケージを巻き込まない', async ({
  cleanup,
  launchApp,
}) => {
  const workDir = mkdtempSync(path.join(tmpdir(), 'apm-e2e-'));
  cleanup(() => rmSync(workDir, { recursive: true, force: true }));
  const fixturesDir = path.join(workDir, 'fixtures');
  const installationPath = path.join(workDir, 'aviutl');
  mkdirSync(installationPath, { recursive: true });

  const { baseUrl, close } = await serveFixtures(fixturesDir);
  cleanup(close);
  writeDataSet(fixturesDir, {
    packages: [
      pkg('e2e/alpha', 'E2E アルファ', baseUrl),
      pkg('e2e/beta', 'E2E ベータ', baseUrl),
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
  await expect(window.locator('#installation-path')).toHaveValue(
    installationPath,
    { timeout: 120_000 },
  );

  await window.getByRole('tab', { name: 'プラグイン&スクリプト' }).click();
  const rows = window.locator('#packages-list li');
  await expect(rows).toHaveCount(2, { timeout: 120_000 });

  const search = window.getByLabel('検索 / 共有');

  // どのパッケージにも 'psd' は含まれない。pageURL の 'https:' を
  // 誤字許容で引くと 2 件とも残ってしまう
  await search.fill('psd');
  await expect(rows).toHaveCount(0);

  // 名前での検索は従来どおり効く
  await search.fill('アルファ');
  await expect(rows).toHaveCount(1);

  // 打ち間違いの許容は残っている(ベータ → べーた ではなく 1 文字違い)
  await search.fill('');
  await expect(rows).toHaveCount(2);
});
