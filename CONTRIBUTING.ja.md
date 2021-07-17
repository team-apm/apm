# Contribution

[English](./CONTRIBUTING.md)

AviUtl Plugin Managerへのコントリビュートに興味を持っていただきありがとうございます！！

コントリビュートの仕方についてガイドします。

## 使用技術 / 言語

このアプリは、[Electron](https://www.electronjs.org/)で使用して作成しています。

使用する言語は以下の通りです。

- JavaScript (Node.js)
- HTML
- CSS

## Issues

以下のIssueは、テンプレートを用意しています。日本語でも英語でも構いません。

- 機能リクエスト (Feature request) [日本語](https://github.com/hal-shu-sato/apm/issues/new?labels=Feedback%3A+enhancement&template=feature_request_ja.md) [English](https://github.com/hal-shu-sato/apm/issues/new?labels=Feedback%3A+enhancement&template=feature_request.md)
- バグ報告 (Bug report) [日本語](https://github.com/hal-shu-sato/apm/issues/new?labels=Problem%3A+bug&template=bug_report_ja.md) [English](https://github.com/hal-shu-sato/apm/issues/new?labels=Problem%3A+bug&template=bug_report.md)

その他のIssueも大歓迎です。

また、開発の仕方やコードの切り分け方、データ形式の仕様など、根本的な改善のIssueも大歓迎です。

## Pull Requests

Pull Requestも大歓迎です。

以下のようなPull Requestを受け付けています。基本的なPull Requestは、Issueを立てなくても問題ありません。

新機能や改善、修正について、疑問がある場合や、大きな新機能や変更の影響が大きい場合は、一度Issueを立てて相談してください。

- バグの修正
- 新機能の追加
- 既存機能の改善
- リファクタリング
- ドキュメントの修正

Pull Requestがマージされた時点で、あなたの貢献が[Contributorsリスト](https://github.com/hal-shu-sato/apm/graphs/contributors)に追加され、コードの内容には[MIT License](./LICENSE)が適用されます。

[CODE OF CONDUCT](./CODE_OF_CONDUCT.md)に反する内容を含むものは受け付けません。

## 修正の確認

修正の確認には、2通りの方法があります。

### コンソールから起動

コンソールから起動することで、手軽に修正を確認できます。

`yarn start`を実行することでアプリが起動します。

### パッケージ化して起動

パッケージ化したアプリを実行することで、より実環境に近い確認ができます。

`yarn package`を実行することで、`out/`にパッケージ化されたアプリが出力されているので、実行します。

## ディレクトリ構造

`src`下に、各画面用のHTML, CSS, プリロードJavaScriptを配置し、ライブラリと各セクションごとにディレクトリを切り、その下にモジュールを配置します。

```text
└── src
    ├── core
    │   └── core.js
    ├── lib
    │   └── someLibrary.js
    ├── plugin
    │   └── plugin.js
    ├── script
    │   └── script.js
    ├── setting
    │   └── setting.js
    ├── some_window.html
    ├── some_window.css
    └── some_window_preload.js
```

## コミットメッセージ規約

AngularのCommit Message Formatをベースとした、Conventional Changelogを使用しています。

- [conventional-changelog/packages/conventional-changelog-angular/README.md](https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog-angular/README.md)

コミットメッセージはコミット時に[commitlint](https://commitlint.js.org/)によって自動でチェックされ、規約に沿っていない場合にはコミットに失敗します。

[standard-version](https://github.com/conventional-changelog/standard-version)を利用して変更履歴を出力しているので、新機能の追加やバグ修正を含むコミットは、とくにこの規約にしたがってください。

### コミットの仕方

コミットメッセージの生成を簡略化するために、[commitizen](https://commitizen.github.io/cz-cli/)を導入しています。

コミット時に、`yarn cm`を使用してください。

その後は、コンソールの指示通りに入力すれば、規約に沿ったコミットメッセージでコミットできます。

日本語化するには、リポジトリのルートディレクトリに`.czrc`ファイルを作成して、以下のように書き込んでください。（このファイルは、Gitから無視されます。）

```json
{
  "path": "cz-conventional-changelog-ja"
}
```

## コードの書き方・ルール

このプロジェクトでは、以下のような書き方・ルールがありますが、コミット時にリントとフォーマットが自動実行されるので、気にしすぎる必要はないかもしれません。

### リント

リントに[ESLint](https://eslint.org/)を使用しており、[Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)をベースに設定しています。内容は以下の通りです。

- ECMAScript 2020を使用できます。
- 変数の宣言には、基本的に`const` / `let`を使用します。
- モジュールの読み込みには、`require`を使用します。
- 関数にはJSDocをコメントします。

### フォーマット

フォーマッターとして、[Prettier](https://prettier.io/)を使用しています。

適用される設定は、[.editorconfig](./.editorconfig)に書かれた内容と、シングルクォーテーションの使用です。
