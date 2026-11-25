/**
 * バンドルせず node_modules ごとパッケージへ同梱する依存。
 *
 * webpack 構成では `@vercel/webpack-asset-relocator-loader` が「自身の
 * __dirname を基準に同梱ファイルを探す」依存を検出してバイナリを
 * native_modules/ へコピーし、参照先を書き換えていた。Vite に同等の仕組みは
 * 無いため、該当パッケージを外部化して __dirname を本来の位置に保つ。
 *
 * 純 JS の依存は bundle した方が起動が速いので、ここに挙げるのは
 * 「bundle すると壊れるもの」だけにする。
 */
const assetBearingDependencies = [
  // path.join(__dirname, "mac"|"win"|"linux", arch, "7za") で実行ファイルを探す
  '7zip-bin',
  // package.json の bin を __dirname 基準で resolve する(7zip-lite/7z.exe)
  'win-7zip',
];

/**
 * Rollup の external にするもの(= バンドルから外し、node_modules ごと同梱する)。
 *
 * かつては「評価順を保つために生の `require()` のまま残す依存」もここにあった
 * (electron-squirrel-startup)。require したその瞬間に Squirrel のイベントを
 * 処理する作りで、AviUtl のショートカット削除との順序が index.ts の行の位置に
 * しか書かれていなかったため、#2417 で src/main/squirrel.ts へ畳んだ。
 */
export const externalDependencies = [...assetBearingDependencies];

/** パッケージへ同梱する node_modules 一覧。 */
export const packagedDependencies = [...externalDependencies];
