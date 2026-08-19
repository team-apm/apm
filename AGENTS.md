# AGENTS.md

AviUtl Package Manager (apm) — AviUtl のプラグイン・スクリプトを管理する Electron 製デスクトップアプリ。TypeScript + webpack (electron-forge)。UI は React + tRPC(main 窓の全タブ + About 窓)。ビジネスロジックは main プロセス(src/main/services)にあり、preload は初期化フロー・contextBridge・tRPC クライアントのみ。

## コマンド

```
yarn lint       # prettier + eslint
yarn lint:ts    # tsc --noEmit
yarn test       # vitest run (src/**/*.test.ts)
yarn test:e2e   # Playwright E2E (e2e/)。パッケージ版を起動するため先に yarn package が必要。--user-data-dir で一時 userData を渡して起動するため実プロファイルは汚さない
yarn start      # 開発起動 (Node 22 推奨)
```

PR 前に上記 3 つ(lint / lint:ts / test)がすべて緑であること。

## 確定方針(変更しない)

- **v4 フルリライトはしない**。Strangler Fig 方式でタブ単位に React + tRPC へ段階移行(About 窓が実装パターンの前例)
- **実現すべき動作は現行コードが仕様書**。移行スライスは「特性化テストで現行動作を固定 → 置き換え → テスト緑」の順
- v3.x を小出しリリース(v4 番号は使わない)。リリースは release-it
- ブランチ: `main` = 開発先頭、`v3` = 最新 v3 タグのマーカー(リリース時に `git branch -f v3 vX.Y.Z`)
- Windows メイン。ビルドは 3 OS 継続
- dataURL は自由入力を維持(allowlist しない)。防御は `src/shared/resolvePath.ts` の同一オリジン + 親ディレクトリ脱出禁止
- テスト: ユニットは Vitest。electron に依存しない純粋関数を優先してテストする
- `src/shared/` = electron 完全非依存の純粋モジュール(main / renderer 両方から import 可)。electron に依存するものは `src/lib/`(renderer 系)や `src/main/` に置く

## 既知の固定と理由(上げる前に必ず読む)

| 固定                                                            | 理由                                                                                                                                                                                               |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI (`build.yml` / `release.yml` / `nodejs.yml`) は Node 22 固定 | Node 24 では electron-forge の package/make/publish が「Copying files」後に無言で失敗する(exit 0 で `.app`/`out` が生成されない。forge 7.11.2 でも再現・ローカルでも同様なので Node 22 で実行する) |
| Electron ほかメジャー更新は dependabot で ignore                | メジャー更新は計画的に 1 PR = 1 major で実施するため(ROADMAP 参照)                                                                                                                                 |

## 作業スタイル

- コミットは細かめ(論理単位で分割)、Conventional Commits(`feat:` `fix:` `build:` `ci:` `docs:` 等、commitlint あり)
- `main` へ直接 push しない。`phase-N/...` 命名のブランチを切って PR 経由
- 分からないこと・方針が割れることは質問してから進める
- テストは意味のあるものだけ。過剰な抽象化・スコープ拡大は避ける
- 書き分けの原則: **コードには How、テストコードには What、コミットログには Why、コードコメントには Why not**。コードコメントは「なぜこう書かないか(採らなかった選択肢・制約)」を残す場所で、コードを読めば分かることは書かない

## 言語規約

| 対象                                                    | 言語                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| UI 文字列・ダイアログ文言                               | 日本語                                                                                     |
| ドキュメント(AGENTS.md / ROADMAP.md 等)                 | 日本語                                                                                     |
| コミット件名・本文、PR タイトル・本文                   | 日本語(type/scope は Conventional Commits の英語。dependabot 等の自動生成は英語のまま許容) |
| テストの describe / it                                  | 日本語                                                                                     |
| コード内の補足コメント(意図・背景の説明)                | 日本語                                                                                     |
| JSDoc の定型部(`@param` / `@returns` の説明文)          | 英語(既存コードに合わせる)                                                                 |
| エラーメッセージ・ログ(`throw new Error` / `log.error`) | 英語(開発者向け内部文字列。ユーザーに見せるダイアログは日本語)                             |
| 識別子(変数・関数・ファイル名)                          | 英語                                                                                       |

## 落とし穴

- `src/lib/compareVersion.ts` の `compareVersion` は比較不能時に `Number.NaN` を返す。NaN は全比較演算子で false になるため、呼び出し側は必ず `Number.isNaN()` で先に分岐する(`!== 0` 形式の分岐は意味が反転する)
- `src/renderer/main/preload.ts` に残る初期化フロー(migration → initSettings → ensureInstallationPath → changeInstallationPath)は順序が仕様。全ステップ tRPC 呼び出しで Node API 依存は無い(Phase 4 の `sandbox: true` 化の前提)
- renderer.tsx は React ルートを機能ごとに分けて createRoot しているため、React Context はルート間で共有できない。複数ルートから共有する実行状態は `packages/packagesListCheck.ts` のようにモジュールシングルトン + `useSyncExternalStore` で持つ。ルート間・レガシーとの通知は DOM イベント(`apm-packages-changed` / `apm-core-changed` / `apm-check-packages-list` / `apm-install-package-by-id`)
- メインワールドの React から import する shared モジュールは electron だけでなく **fs にも依存不可**(renderer の webpack ビルドに Node ポリフィルが無いため、fs-extra が混入するとビルドが落ちる)。表示用の定数・純関数は `src/shared/packageDisplay.ts` のように fs 非依存モジュールへ分離する
- trpc-electron(electron-trpc の tRPC 11 対応フォーク。0.7.1 までの本家は tRPC 11 非互換)は falsy なトップレベル入力(`false` / `0` / `''`)を `undefined` に変換する(main ハンドラが `input: g ? deserialize(g) : void 0` と真偽値評価しているため)。tRPC procedure の入力にプリミティブの boolean / number を直接渡さず、必ずオブジェクトで包む(`{ update: boolean }` 等)
- `monaco-editor` は**型のみ**インポートする(`import type`)。実行時の Monaco は CopyWebpackPlugin が `main_window/vs` に同梱する AMD ビルドを `@monaco-editor/loader` が読み込む(CSP に CDN 許可を持たないため CDN 読み込みは不可)。値インポートすると webpack が Monaco 全体をバンドルし、ビルドにヒープ拡大(`--max-old-space-size`)が必要になる。enum 値は onMount で渡される `monaco` インスタンスから取る
- main 窓には tRPC クライアントが 2 つある(隔離ワールドのレガシー用 `lib/trpcClient.ts` / メインワールドの React 用 `TrpcProvider.tsx`)。trpc-electron は応答を `event.reply` で送るため**両ワールドの ipcRenderer に届き**、renderer 側は数値のリクエスト ID だけで照合する。各クライアントが独立に 1 から採番すると ID 衝突時に**他方のリクエストへの応答で resolve される**(型もチェックされない)。`shared/trpcIdNamespace.ts` のリンクで ID 空間を奇数/偶数に分離済み。同一窓に tRPC クライアントを追加する場合は必ずこのリンクを ipcLink の手前に挟む
