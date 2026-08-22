// リリース時にサイトのダウンロードリンクを新しいバージョンへ向ける。
// release-it の after:bump フックから呼ばれ、書き換えた _config.yml は
// release-it 自身の `git add . --update` でリリースコミットに含まれる
// (CI から main へ書き戻す必要がない)。
import { readFile, writeFile } from 'node:fs/promises';

const CONFIG_PATH = new URL('../docs/_config.yml', import.meta.url);

/**
 * Returns the release asset URLs for a version.
 * 成果物名は electron-forge の maker が productName とバージョンから
 * 組み立てるため、バージョンが決まれば URL も決まる。
 * @param {string} version - The version being released, without the leading v.
 * @returns {{exe: string, zip: string}} The asset URLs.
 */
function assetUrls(version) {
  const base = `https://github.com/team-apm/apm/releases/download/v${version}`;
  return {
    exe: `${base}/AviUtl.Package.Manager-${version}.Setup.exe`,
    zip: `${base}/AviUtl.Package.Manager-win32-x64-${version}.zip`,
  };
}

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+/.test(version ?? '')) {
  throw new Error(`Expected a version as the first argument, got ${version}`);
}

const urls = assetUrls(version);
const original = await readFile(CONFIG_PATH, 'utf8');
const updated = original
  .replace(/^(\s*exe_url:\s*).*$/m, `$1${urls.exe}`)
  .replace(/^(\s*zip_url:\s*).*$/m, `$1${urls.zip}`);

// 置換されなければキーの名前や構造が変わっている。黙って古い URL を
// 残すとサイトだけ旧版を配り続けるため、リリースを止める
if (!updated.includes(urls.exe) || !updated.includes(urls.zip)) {
  throw new Error(
    'docs/_config.yml の exe_url / zip_url を書き換えられなかった。' +
      'キー名か構造が変わっていないか確認すること。',
  );
}

if (updated !== original) await writeFile(CONFIG_PATH, updated);
console.log(`docs/_config.yml のダウンロードリンクを v${version} へ更新した`);
