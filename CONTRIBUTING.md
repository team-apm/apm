# Contribution

[日本語](./CONTRIBUTING.ja.md)

Thank you for your interest in contributing to the AviUtl Plugin Manager!

Here is a guide on how to contribute.

## Technology/Language Used

This application has been created using [Electron](https://www.electronjs.org/).

The languages used are:

- JavaScript (Node.js)
- HTML
- CSS

## Issues

A template is provided for the following issues. You can use either English or Japanese.

- Feature request [English](https://github.com/hal-shu-sato/apm/issues/new?labels=Feedback%3A+enhancement&template=feature_request.md) [日本語](https://github.com/hal-shu-sato/apm/issues/new?labels=Feedback%3A+enhancement&template=feature_request_ja.md)
- Bug Report [English](https://github.com/hal-shu-sato/apm/issues/new?labels=Problem%3A+bug&template=bug_report.md) [日本語](https://github.com/hal-shu-sato/apm/issues/new?labels=Problem%3A+bug&template=bug_report_ja.md)

Other Issues are also welcome.

We also welcome fundamental improvement issues, such as how to develop, how to separate code, data format specification, etc.

## Pull Requests

Pull Requests are also welcome.

We accept the following types of pull requests. You don't need to make an Issue for basic Pull Requests.

If you have a question about a new feature, improvement, or fix, or if the impact of a major new feature or change is significant, please make an Issue to discuss it.

- Fixing a bug
- Adding a new feature
- Improve an existing feature
- Refactoring
- Fixing documentation

When the pull request is merged, your contribution will be added to the [Contributors list](https://github.com/hal-shu-sato/apm/graphs/contributors), and the [MIT License](./LICENSE) will be applied to the code content.

And after that, if you don't mind, add your name to [credits](./src/about.html) and send a pull request.

Submissions containing content that violates the [CODE OF CONDUCT](./CODE_OF_CONDUCT.md) will not be accepted.

## Confirmation of Modifications

There are two ways to check your modifications.

### Launch from the Console

By starting from the console, you can easily check your modifications.

Run `yarn start` to start the application.

### Package and Run

By running the packaged app, you can check it closer to the real environment.

By running `yarn package`, the packaged app is output to `out/`, so run it.

## Directory Structure

Under `src`, place HTML, CSS, and preloaded JavaScript for each screen, and cut directories for each library and each section, and place modules under them.

```text
└── src
    ├── core
    │   └── core.js
    ├── lib
    │   └── someLibrary.js
    ├── package
    │   └── package.js
    ├── setting
    │   └── setting.js
    ├── some_window.html
    ├── some_window.css
    └── some_window_preload.js
```

## Commit Message Convention

We are using Conventional Changelog, which is based on Angular's Commit Message Format.

- [conventional-changelog/packages/conventional-changelog-angular/README.md](https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog-angular/README.md)

The commit message is automatically checked by [commitlint](https://commitlint.js.org/) at commit time, and the commit will fail if it does not follow the conventions.

Since [Standard Version](https://github.com/conventional-changelog/standard-version) is used to output the changelog, commits that contain new features or bug fixes should especially follow this convention.

### How to Commit

To simplify the generation of commit messages, [Commitizen](https://commitizen.github.io/cz-cli/) has been introduced.

Use `yarn cm` when committing.

After that, you can commit with a commit message that follows the conventions by typing as instructed in the console.

## Code Writing Style/Rules

This project has the following writing style/rules, but you may not need to worry too much about it since linting and formatting are automatically performed at commit time.

### Linting

We are using [ESLint](https://eslint.org/) for linting, and the settings are based on the [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html). The contents are as follows.

- ECMAScript 2020 can be used.
- Basically, use `const` / `let` to declare variables.
- Use `require` to load modules.
- Comment functions with JSDoc.

### Formatting

We are using [Prettier](https://prettier.io/) as the formatter.

The settings to be applied are those written in [.editorconfig](./.editorconfig) and the use of single quotes.
