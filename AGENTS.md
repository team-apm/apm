# AGENTS.md

AviUtl Package Manager (apm) — AviUtl のプラグイン・スクリプトを管理する Electron 製デスクトップアプリ。TypeScript + webpack (electron-forge)。UI はレガシー DOM + preload 中心で、About 窓のみ React + tRPC(移行の手本)。

## コマンド

```
yarn lint       # prettier + eslint
yarn lint:ts    # tsc --noEmit
yarn test       # vitest run (src/**/*.test.ts)
yarn start      # 開発起動 (Node 22 推奨)
```

PR 前に上記 3 つ(lint / lint:ts / test)がすべて緑であること。

## 確定方針(変更しない)

- **v4 フルリライトはしない**。Strangler Fig 方式でタブ単位に React + tRPC へ段階移行(About 窓が実装パターンの前例)
- **実現すべき動作は現行コードが仕様書**。移行スライスは「特性化テストで現行動作を固定 → 置き換え → テスト緑」の順
- v3.x を小出しリリース(v4 番号は使わない)。リリースは release-it
- ブランチ: `main` = 開発先頭、`v3` = 最新 v3 タグのマーカー(リリース時に `git branch -f v3 vX.Y.Z`)
- Windows メイン。ビルドは 3 OS 継続
- dataURL は自由入力を維持(allowlist しない)。防御は `src/lib/resolvePath.ts` の同一オリジン + 親ディレクトリ脱出禁止
- テスト: ユニットは Vitest。electron に依存しない純粋関数を優先してテストする

## 既知の固定と理由(上げる前に必ず読む)

| 固定                                                            | 理由                                                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `@electron-forge/*` 6.4.1 固定(`.ncurc.json` で reject)         | 6.4.2+ で preload の webpack ビルドが壊れる                                             |
| CI (`build.yml` / `release.yml` / `nodejs.yml`) は Node 22 固定 | Node 24 では electron-forge 6.4.1 の make/publish が「Copying files」後に無言で失敗する |
| Electron ほかメジャー更新は dependabot で ignore                | メジャー更新は計画的に 1 PR = 1 major で実施するため(ROADMAP 参照)                      |

## 作業スタイル

- コミットは細かめ(論理単位で分割)、Conventional Commits(`feat:` `fix:` `build:` `ci:` `docs:` 等、commitlint あり)
- `main` へ直接 push しない。`phase-N/...` 命名のブランチを切って PR 経由
- 分からないこと・方針が割れることは質問してから進める
- テストは意味のあるものだけ。過剰な抽象化・スコープ拡大は避ける

## 落とし穴

- `src/lib/compareVersion.ts` の `compareVersion` は比較不能時に `Number.NaN` を返す。NaN は全比較演算子で false になるため、呼び出し側は必ず `Number.isNaN()` で先に分岐する(`!== 0` 形式の分岐は意味が反転する)
- `src/renderer/main/preload.ts` はビジネスロジックそのもの(`sandbox: false` 前提)。タブの React 化 = そのタブのロジックを main プロセス + tRPC へ移設する作業
