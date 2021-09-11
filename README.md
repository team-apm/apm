# AviUtl Package Manager

[![Build](https://github.com/hal-shu-sato/apm/actions/workflows/build.yml/badge.svg)](https://github.com/hal-shu-sato/apm/actions/workflows/build.yml)
[![GitHub issues](https://img.shields.io/github/issues/hal-shu-sato/apm)](https://github.com/hal-shu-sato/apm/issues)
[![GitHub license](https://img.shields.io/github/license/hal-shu-sato/apm)](https://github.com/hal-shu-sato/apm/blob/main/LICENSE)
![GitHub package.json version](https://img.shields.io/github/package-json/v/hal-shu-sato/apm)
![GitHub all releases](https://img.shields.io/github/downloads/hal-shu-sato/apm/total)

AviUtl本体やプラグイン・スクリプトの導入を補助するソフトウェアです。

Read this in [English](./README.en.md).

- AviUtl本体と拡張編集の自動ダウンロード・アップデート
- プラグインとスクリプトの自動ダウンロード・アップデート・削除
- 50を超えるプラグイン・スクリプトにデフォルトで対応
- プラグイン・スクリプトの検索と紹介ページの確認

## インストール

[apm/releases](https://github.com/hal-shu-sato/apm/releases)のAssets欄からダウンロードした`AviUtl.Plugin.Manager-{version}.Setup.exe`を実行してインストールを行います。

インストール不要のzip版を利用する場合は`AviUtl.Plugin.Manager-{os}-{version}.zip`をダウンロードして任意の場所に展開します。

## 使用方法

### すでにAviutlをお使いの場合

1. AviUtl Package Managerを起動
2. 「インストール先フォルダを選択」からAviutlがインストールされているフォルダを選択します
3. 「インストール済みのバージョン」に「手動インストール」と表示されていることを確認します
4. すでにプラグインを導入している場合、「Plugins&Scripts」タブを開き一番下までスクロールします。追加されたファイルの一覧が表示されていることを確認します

### 新規インストールの場合

1. AviUtl Package Managerを起動
2. 「インストール先フォルダを選択」からAviutlをインストールする新しいフォルダを選択します
3. Aviutl・拡張編集のバージョンを選択してインストールボタンを押します
4. 「インストール済みのバージョン」にインストールしたバージョンが表示されていることを確認します

### プラグイン・スクリプトの導入

1. 「Plugins&Scripts」タブを開き、インストールしたいプラグインを選択します
2. プラグインの情報が表示されます。URLをブラウザで開き利用規約や注意事項をよく確認してください
   - インストール後に必要な設定もチェックします
3. 「インストール」ボタンを押します
4. 表示された作者サイトから、リストに表示された「最新バージョン」と同じバージョンのファイルをダウンロードしてください
5. インストールは自動で行われます

### プラグイン・スクリプト一覧への追加

プラグイン・スクリプト一覧への追加・更新・削除等の要望は[apm-data](https://github.com/hal-shu-sato/apm-data/issues)にて受け付けています。

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

[MIT license](./LICENSE)

## 開発者

**ato lash**

- [GitHub](https://github.com/hal-shu-sato)
- [Homepage](http://halshusato.starfree.jp/)
- [Twitter](https://twitter.com/hal_shu_sato)
