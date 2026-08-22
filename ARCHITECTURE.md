# ARCHITECTURE

apm の構造の現在地。作業ルール・確定方針は [AGENTS.md](AGENTS.md) を参照。

## プロセス構成

Electron の 3 窓 + main プロセス。窓はすべて `sandbox: true`。

| 窓     | renderer                                                                                                               | preload                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| main   | `src/renderer/main/`(単一 React ルートの `App` + tRPC。タブ単位のディレクトリ。起動フローは `startup.ts` — 順序が仕様) | ログ捕捉 + tRPC bridge 公開のみ |
| about  | `src/renderer/about/`(React + tRPC)                                                                                    | ログ捕捉 + tRPC bridge 公開のみ |
| splash | `src/renderer/splash/`                                                                                                 | なし                            |

- ビジネスロジックは main プロセス(`src/main/services/`)。renderer からは tRPC(trpc-electron)で呼ぶ
- このほか `services/browser.ts` がダウンロード用のモーダルブラウザ窓を動的に生成する(forge の renderer エントリではない)
- IPC は tRPC に集約済み。例外は preload のエラーハンドラ用ダイアログの 1 チャンネルのみ(`src/common/ipc.ts` + `src/lib/ipcWrapper.ts`。preload に tRPC クライアントを置けない理由は `src/common/ipc.ts` のコメントを参照)

## ディレクトリと責務

```
src/
  shared/     electron 完全非依存の純粋モジュール(main / renderer 両方から import 可)。
              ユニットテストの主対象。fs 依存の可否は AGENTS.md 落とし穴を参照
  lib/        renderer から使う electron 依存モジュール(ipcWrapper = preload 専用)
  common/     preload 専用 IPC のチャンネル名定義(ipc.ts)
  main/       main プロセス(下記)
  renderer/   窓ごとの UI(上の表を参照)。main/ 配下はタブ単位
              (aviutl / packages / nicommons / settings / others)
  types/      型定義
```

main プロセスの内訳:

```
src/main/
  index.ts        エントリ(ログ・config 初期化、app イベント、ハンドラ登録)
  windows.ts      窓生成(splash / main / about)+ tRPC ハンドラの張り付け
  ipcHandlers.ts  preload 専用 IPC ハンドラの登録(エラーダイアログのみ)
  api/            tRPC ルーター(index = 集約、trpc = middleware、
                  ドメイン別ルーターの procedure から services/ を呼ぶ。
                  installationPath 入力は middleware が Installation に解決して渡す)
  services/       ビジネスロジック(packageList / packageInstall /
                  packageUninstall / scriptInstall / packageShare / core /
                  download / modList / migration / appUpdate / settings /
                  nicommons / browser)
  Config.ts       electron-store による設定
  installation.ts インストール先の集約 Installation(path / ledger() /
                  localRepoPath)。ユースケース系 services が受け取る
  Ledger.ts       導入記録 Ledger = {installationPath}/apm.json の読み書き
```

## データフロー(パッケージ管理の中核)

```mermaid
graph LR
  D[dataURL<br>既定: apm-data] -->|"download.ts"| T["一時ファイル<br>list.json / packages.json"]
  L["{installationPath}/packages.json<br>{installationPath}/editorPackages.json"] --> M
  T --> M["パッケージ一覧<br>modList.ts + packageList.ts"]
  M --> I["インストール / 更新判定<br>installPackageFlow(packageInstall.ts)"]
  I -->|"unzip + copy<br>(shared/install.ts)"| P["{installationPath}/plugins, script 等"]
  I -->|導入記録| A["{installationPath}/apm.json<br>(Ledger)"]
```

- dataURL は自由入力(allowlist しない)。防御は `src/shared/resolvePath.ts` の同一オリジン + 親ディレクトリ脱出禁止(確定方針)
- `{installationPath}` = ユーザーが選ぶ AviUtl インストールフォルダ。apm の状態はすべてここと electron-store(`Config.ts`)にある
- ファイルの整合性は apm-data 側の ssri ハッシュを `src/shared/integrity.ts` で検証

## ビルド構成(Vite + electron-forge)

`forge.config.ts` の `VitePlugin` が 3 種類のターゲットをビルドする。設定は種類ごとにファイルが分かれ、共有部分は `vite.base.config.ts` / `vite.plugins.config.ts` に置く。

| ターゲット | 入口                                          | 設定                      | 出力                                  |
| ---------- | --------------------------------------------- | ------------------------- | ------------------------------------- |
| main       | `src/main/index.ts`                           | `vite.main.config.ts`     | `.vite/build/main.js`(CJS)            |
| preload    | `src/renderer/{main,about}/preload.ts`        | `vite.preload.config.ts`  | `.vite/build/{main,about}_preload.js` |
| renderer   | `src/renderer/{main,about,splash}/index.html` | `vite.renderer.config.ts` | `.vite/renderer/{name}/`              |

- **renderer は `index.html` が入口**。Vite は HTML を起点にビルドするため、各 `index.html` が `<script type="module" src="./renderer.tsx">` で自分のエントリを指す
- 窓ごとに Vite の `root` を移して出力を `.vite/renderer/{name}/index.html` に平坦化している。main プロセスは dev なら `*_VITE_DEV_SERVER_URL`、製品版なら `loadFile('../renderer/{name}/index.html')` で読む(`src/main/windows.ts`)
- preload は 2 本とも `preload.ts` という同名なので、出力名を親ディレクトリ名から `{main,about}_preload.js` に振り分けている(共有の `outDir` で後勝ち上書きになるため)
- **バンドルできない依存**(自身の `__dirname` からファイルを読む `7zip-bin` / `win-7zip` / `electron-prompt`)は external にして `node_modules` ごとパッケージへ同梱する。取りこぼしはパッケージ版だけが静かに壊れるため、`assertExternals` プラグインがビルド時に検出する
- Monaco は依存解決に載せず、`monacoAssets` プラグインが AMD ビルドを `vs/` として同梱する(dev は同じ `/vs` を middleware で配信)。CSP から CDN 許可を外すための構成
- CSP は `index.html` の meta が単一ソース。dev のみ `devContentSecurityPolicy` プラグインが Fast Refresh のインライン script を通すために緩める(出力には影響しない)

## このドキュメントの更新

構造が変わる PR(ディレクトリ再編、services の追加・移設、窓や IPC 系統の変更、ビルド構成の変更)では、この文書の該当箇所を同じ PR で更新する。
