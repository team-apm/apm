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
 * 評価順を保つために生の `require()` のまま残す依存と、その実行時依存。
 *
 * webpack は `require()` を静的に解決して「その行の位置のまま」bundle して
 * いたが、Rollup にその機能は無い。静的 import へ直すと ESM の規則で
 * import 側の本体より先に評価されてしまい、副作用の順序が変わる。
 */
const positionalRequireDependencies = [
  // require した時点で Squirrel のイベントを処理し、--squirrel-uninstall では
  // Update.exe を spawn してその完了で app.quit() する。apm 側の
  // shortcut.uninstaller(AviUtl のショートカット削除)を必ず先に走らせる
  // 必要があるため(src/main/shortcut.ts の JSDoc)、位置を動かせない
  'electron-squirrel-startup',
];

/** Rollup の external にするもの(= バンドルから外し、node_modules ごと同梱する)。 */
export const externalDependencies = [
  ...assetBearingDependencies,
  ...positionalRequireDependencies,
];

/**
 * 同梱だけするもの(external にはしない)。
 *
 * 外部化した依存がさらに実行時 require する分。external に足すと
 * 「バンドル内の別のコードからの import」まで外部化されてしまい、
 * 起動時の require が無駄に増えるため、同梱の一覧にだけ載せる。
 */
const runtimeOnlyDependencies = [
  // electron-squirrel-startup → debug → ms
  'debug',
  'ms',
];

/** パッケージへ同梱する node_modules 一覧。 */
export const packagedDependencies = [
  ...externalDependencies,
  ...runtimeOnlyDependencies,
];
