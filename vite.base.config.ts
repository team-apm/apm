/**
 * webpack 構成での `@vercel/webpack-asset-relocator-loader` の代替。
 *
 * relocator は「自身の __dirname を基準に同梱ファイルを探す」依存を検出し、
 * バイナリを native_modules/ へコピーして参照先を書き換えていた。Vite には
 * 同等の仕組みが無いため、該当パッケージだけ bundle せず外部化し、
 * node_modules ごとパッケージに含めて __dirname を本来の位置に保つ。
 *
 * ここに挙げるのは「JS 以外の同梱ファイルを実行時に読む」パッケージのみ。
 * 純 JS の依存は bundle した方が起動が速いので外部化しない。
 */
export const assetBearingDependencies = [
  // path.join(__dirname, "mac"|"win"|"linux", arch, "7za") で実行ファイルを探す
  '7zip-bin',
  // package.json の bin を __dirname 基準で resolve する(7zip-lite/7z.exe)
  'win-7zip',
  // path.join(__dirname, "page", "prompt.html") をプロンプト窓に読み込む
  'electron-prompt',
];
