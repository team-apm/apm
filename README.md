# ![Logo](./icon/apm32.png) AviUtl Package Manager

[![Build](https://github.com/hal-shu-sato/apm/actions/workflows/build.yml/badge.svg)](https://github.com/hal-shu-sato/apm/actions/workflows/build.yml)
[![GitHub issues](https://img.shields.io/github/issues/hal-shu-sato/apm)](https://github.com/hal-shu-sato/apm/issues)
[![GitHub license](https://img.shields.io/github/license/hal-shu-sato/apm)](https://github.com/hal-shu-sato/apm/blob/main/LICENSE)
[![GitHub package.json version](https://img.shields.io/github/package-json/v/hal-shu-sato/apm)](https://github.com/hal-shu-sato/apm/releases/latest)
![GitHub all releases](https://img.shields.io/github/downloads/hal-shu-sato/apm/total)

<p>
  <img src="./docs/images/tab1.png" width="160" />
  <img src="./docs/images/tab2.png" width="160" />
  <img src="./docs/images/tab1dark.png" width="160" />
  <img src="./docs/images/tab2dark.png" width="160" />
</p>

AviUtlを手軽に導入できるソフトウェアです

- AviUtl・拡張編集やプラグイン・スクリプトのインストール
- 50を超えるプラグインと多数のスクリプトに対応
- インストール済みのAviUtlへ追加可能

_Read this in [English](./README.en.md)_.

## ダウンロード

[ダウンロードページ](https://hal-shu-sato.github.io/apm/)からAviUtl Package Managerをダウンロードします

## 準備

1. AviUtl Package Managerの起動後、
   - 既にAviutlをお使いの場合は、「インストール先フォルダを選択」からAviutlがインストールされているフォルダを選択します
   - 新規インストールの場合は、「おすすめ一括インストール」を押してAviUtl・拡張編集とmp4の入出力に必要なプラグインをインストールします
2. スタートメニューにAviUtlが追加されているはずです。AviUtlを起動して動画編集を始めましょう！

## パッケージ（プラグイン・スクリプト）の導入

1. 「Plugins&Scripts」タブからインストールするパッケージを選びます
2. パッケージの説明が表示されます
   - URLをブラウザで開き利用規約、注意事項やインストール後に必要な設定を確認してください
3. 「インストール」ボタンを押します
4. 表示された作者サイトから、リストに表示されているバージョンと同じバージョンのファイルをダウンロードします

### パッケージ一覧にないスクリプトを導入する場合

1. 「Plugins&Scripts」タブを開き、「インストール▼>リストにないスクリプトのインストール」を選択します
2. 表示されるリンクから作者サイトに移動して、スクリプトをダウンロードします

### その他

- 上記の方法で導入できないパッケージも、手動でファイルをコピーする従来の方法により導入できます
- 動作確認は、Windows版のみで行っています
  - Mac版・Linux版は動作保証しておりませんが、問題等が発生した場合はIssueを作成して報告いただければ、対応します
- プラグイン・スクリプト一覧への追加・更新・削除等の要望がありましたら[apm-data](https://github.com/hal-shu-sato/apm-data/issues)までご連絡ください

## コントリビューション

### 前提条件

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) LTSバージョン（現在14.x.x）
- [Yarn 1](https://classic.yarnpkg.com/)

### クローン

任意の場所で以下のコマンドを実行します。

```bash
git clone https://github.com/hal-shu-sato/apm.git
```

あるいは、リポジトリをフォークした後、以下のコマンドを実行します。

```bash
git clone https://github.com/${ユーザー名}/apm.git
```

### 環境構築

クローンしたディレクトリに移動した後、パッケージをインストールします。

```bash
cd apm
yarn
```

### 実行

アプリを起動します。

```bash
yarn start
```

詳しくは、[CONTRIBUTING.ja.md](./CONTRIBUTING.ja.md)を参照してください。

英語やi18nに関するプルリクエストは大歓迎です！

### 使用言語・フレームワーク

- Electron (Node.js)
  - HTML
  - CSS
  - JavaScript

## ライセンス

ソースコード: [MIT license](./LICENSE)

## 開発者

ato lash

- [GitHub](https://github.com/hal-shu-sato)
- [Homepage](http://halshusato.starfree.jp/)
- [Twitter](https://twitter.com/hal_shu_sato)

## コントリビューター

[@mitosagi](https://github.com/mitosagi)
