# AGENTS.md

AviUtl Package Manager (apm) — AviUtl のプラグイン・スクリプトを管理する Electron 製デスクトップアプリ。TypeScript + webpack (electron-forge)。UI は React + tRPC(main 窓は単一ルートの App、About 窓も React)。ビジネスロジックは main プロセス(src/main/services)にあり、preload はログ捕捉と tRPC bridge の公開のみ(初期化フローは renderer 側の startup.ts)。

## 構成

| パス                 | 役割                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/`          | メインプロセス。`index.ts` = エントリ、`api.ts` = tRPC ルーター、`services/` = ビジネスロジック                                                      |
| `src/renderer/`      | 窓ごと(`main` / `about` / `splash`)。forge.config.ts の entryPoints と 1:1 対応                                                                      |
| `src/renderer/main/` | main 窓。単一 React ルート(`App.tsx`)+ タブごとのディレクトリ(`aviutl` / `packages` / `nicommons` / `settings` / `others`)+ 起動フロー(`startup.ts`) |
| `src/lib/`           | renderer から使う electron 依存モジュール(`ipcWrapper.ts`)                                                                                           |
| `src/shared/`        | electron 非依存の純粋モジュール。ユニットテストの主対象                                                                                              |
| `src/common/ipc.ts`  | レガシー IPC のチャンネル名定義                                                                                                                      |

プロセス構成・main プロセスの内訳・データフローの詳細は ARCHITECTURE.md を参照。

## コマンド

```
yarn lint       # prettier + eslint(--check。自動修正は yarn fix)
yarn lint:ts    # tsc --noEmit
yarn test       # vitest run (src/**/*.test.ts)
yarn package    # electron-forge package(ThirdPartyNotices 生成込み)
yarn test:e2e   # Playwright E2E (e2e/)。パッケージ版を起動するため先に yarn package が必要。--user-data-dir で一時 userData を渡して起動するため実プロファイルは汚さない
yarn start      # 開発起動 (Node 22 推奨)
```

PR 前に上記 3 つ(lint / lint:ts / test)がすべて緑であること。

## 確定方針(変更しない)

開発方針の単一ソース(旧 ROADMAP.md を統合)。変更は PR 経由で行う(履歴 = 意思決定ログ)。

- **apm は AviUtl1 専用。AviUtl2(ExEdit2)には対応しない**(#2163、2026-08 決定。理由は下の却下表)。ただしこの判断は 2026-08 時点の競争環境に依存しているため、**前提が崩れたら再評価する**(再評価条件: aviutl2-catalog の開発停止・apm-data 相当の資産が流用可能になる形式変更・インストーラ版のパス構造変更のいずれか)
- **v4 フルリライトはしない**。main 窓のタブ移行(Strangler Fig)は完了。新規画面・大改修する画面は React + tRPC で書く(About 窓が実装パターンの前例)
- **実現すべき動作は現行コードが仕様書**。置き換えは「特性化テストで現行動作を固定 → 置き換え → テスト緑」の順。この原則の動機は、構造改善(移行)の最中に挙動変更の判断を持ち込まないこと。現行動作が明らかに不自然(バグ)でも**置き換え PR 内では保存**し、issue 化して別 PR で直す(挙動変更と構造変更を同じ PR に混ぜない)
- v3.x を小出しリリース(v4 番号は使わない)。リリースは release-it(手順は docs/RELEASING.md、ブランチ運用は BRANCHING.md)
- Windows メイン。明らかなクラッシュは直す。ビルドは 3 OS 継続 — mac/Linux 版に確たる実需要があるからではなく、開発環境が macOS であること(開発者自身の動作確認に必要)と、ファイル操作中心のアプリでクロスプラットフォーム維持コストが低いことが理由。維持コストが上がったら縮小を検討してよい
- dataURL は自由入力を維持(allowlist しない)。防御は `src/shared/resolvePath.ts` の同一オリジン + 親ディレクトリ脱出禁止 + 未承認オリジン追加時の一度だけの確認ダイアログ(#2377)+ README/SECURITY での注意喚起
- i18n は後回し(まず日本語のまま。英語 UI は #1879)
- メジャー依存更新は 1 PR = 1 major(dependabot は major を ignore — 下の「既知の固定」)
- テスト: ユニットは Vitest。electron に依存しない純粋関数を優先してテストする
- `src/shared/` = electron 完全非依存の純粋モジュール(main / renderer 両方から import 可)。electron に依存するものは `src/lib/`(renderer 系)や `src/main/` に置く

### 却下した選択肢(再提案しない)

| 選択肢                                 | 却下理由                                                                                                                                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| v4 全面リライト(#2169)                 | 機能喪失リスクが大きく、コンフリクトも解消不能に近い。Strangler Fig の段階移行で置き換えた                                                                                                                                                                                     |
| AviUtl2(ExEdit2)対応(#2163)            | プラグインが完全新形式で v1 と非互換のため apm-data の資産(285 件)が流用できない。instPath 単一基準のパス解決がインストーラ版 AviUtl2(exe と ProgramData 分離・要管理者昇格)と構造的に不適合。専用マネージャの aviutl2-catalog が 1 年先行しており、後発参入の投資対効果がない |
| dataURL の allowlist 化                | 自作パッケージ・サードパーティデータの検証というユースケースを壊す                                                                                                                                                                                                             |
| semantic-release / changesets への移行 | release-it + conventional-changelog で十分。ツール入れ替えのコストに見合わない                                                                                                                                                                                                 |
| React 移行と同時の i18n 導入           | 移行の変更量を最小に保つため分離                                                                                                                                                                                                                                               |

## 既知の固定と理由(上げる前に必ず読む)

| 固定                                                                        | 理由                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI (`build.yml` / `release.yml` / `nodejs.yml` / `e2e.yml`) は Node 22 固定 | Node 24 では electron-forge の package/make/publish が「Copying files」後に無言で失敗する(exit 0 で `.app`/`out` が生成されない。forge 7.11.2 でも再現・ローカルでも同様なので Node 22 で実行する)。これは恒久方針ではなく回避策 — **forge または Electron のメジャー更新時に Node 24 での package を再検証し、直っていたら固定を外す**。package.json の `engines: "24.x \|\| 22.x"` は意図的(開発起動 `yarn start` は Node 24 でも動く。22 必須なのは package/make/publish のみ) |
| Electron ほかメジャー更新は dependabot で ignore                            | メジャー更新は計画的に 1 PR = 1 major で実施するため(確定方針)。Electron のメジャー更新は上の forge 制約との両立確認を先に行う                                                                                                                                                                                                                                                                                                                                                    |

## 作業スタイル

- コミットは細かめ(論理単位で分割)、Conventional Commits(`feat:` `fix:` `build:` `ci:` `docs:` 等、commitlint あり)
- `main` へ直接 push しない。ブランチを切って PR 経由(ブランチ運用は BRANCHING.md)
- 分からないこと・方針が割れることは質問してから進める
- テストは意味のあるものだけ。過剰な抽象化・スコープ拡大は避ける
- 書き分けの原則: **コードには How、テストコードには What、コミットログには Why、コードコメントには Why not**。コードコメントは「なぜこう書かないか(採らなかった選択肢・制約)」を残す場所で、コードを読めば分かることは書かない

## 言語規約

| 対象                                                    | 言語                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| UI 文字列・ダイアログ文言                               | 日本語                                                                                     |
| ドキュメント(AGENTS.md / ARCHITECTURE.md 等)            | 日本語                                                                                     |
| コミット件名・本文、PR タイトル・本文                   | 日本語(type/scope は Conventional Commits の英語。dependabot 等の自動生成は英語のまま許容) |
| テストの describe / it                                  | 日本語                                                                                     |
| コード内の補足コメント(意図・背景の説明)                | 日本語                                                                                     |
| JSDoc の定型部(`@param` / `@returns` の説明文)          | 英語(既存コードに合わせる)                                                                 |
| エラーメッセージ・ログ(`throw new Error` / `log.error`) | 英語(開発者向け内部文字列。ユーザーに見せるダイアログは日本語)                             |
| 識別子(変数・関数・ファイル名)                          | 英語                                                                                       |

## 落とし穴

機械化できる制約は ESLint で強制し、背景説明は該当コードのコメントに置く(ここには lint・型で守れない判断基準だけを残す)。lint 化済み: monaco-editor の型のみインポート、renderer / lib での fs 直接 import 禁止(いずれも `eslint.config.mjs` の `no-restricted-imports`)。コード側に説明があるもの: `compareVersion` の NaN 返却(JSDoc)、起動フローの順序(`src/renderer/main/startup.ts` のコメント)。

- main 窓は単一 React ルートだが、複数箇所から共有する実行状態(一覧再取得の phase・instPath・firstLaunch)は `packages/packagesListCheck.ts` のようにモジュールシングルトン + `useSyncExternalStore` で持つ(起動元と表示側が別タブにまたがるため)。コンポーネント間の再取得通知は DOM イベント(`apm-packages-changed` / `apm-core-changed` / `apm-check-packages-list` / `apm-install-package-by-id`)が残っている(queryClient への一本化は Phase 5 の設計しなおしで検討)
- 1 窓に tRPC クライアントを複数作らない(main 窓は `TrpcProvider`、about 窓は `App` の 1 個ずつ)。複数作るとリクエスト ID が衝突し、**他方のリクエストへの応答で resolve される**。かつて preload 側クライアントと共存させるため `shared/trpcIdNamespace.ts` で ID 空間を偶奇分離していた — 再び複数が必要になったら git 履歴から復元する
- メインワールドの React から import する shared モジュールは electron だけでなく **fs にも依存不可**(renderer の webpack ビルドに Node ポリフィルが無いため、fs-extra が混入するとビルドが落ちる)。直接 import は lint が検出するが、**shared モジュール経由の推移的な fs 依存は lint で検出できない**(webpack のビルド失敗が検出線)。表示用の定数・純関数は `src/shared/packageDisplay.ts` のように fs 非依存モジュールへ分離する
- trpc-electron(electron-trpc の tRPC 11 対応フォーク。0.7.1 までの本家は tRPC 11 非互換)は falsy なトップレベル入力(`false` / `0` / `''`)を `undefined` に変換する(main ハンドラが `input: g ? deserialize(g) : void 0` と真偽値評価しているため)。tRPC procedure の入力にプリミティブの boolean / number を直接渡さず、必ずオブジェクトで包む(`{ update: boolean }` 等)
