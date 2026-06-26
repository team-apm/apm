# Contribution

[日本語](./CONTRIBUTING.ja.md)

Thank you for your interest in contributing to the AviUtl Package Manager!

Here is a guide on how to contribute.

## Technology/Language Used

This application is built with [Electron](https://www.electronjs.org/).

The languages and frameworks used include:

- TypeScript
- JavaScript (Node.js)
- HTML / CSS
- React (About window; main window migration in progress)
- tRPC (partial)

## Issues

A template is provided for the following issues. You can use either English or Japanese.

- Feature request [English](https://github.com/team-apm/apm/issues/new?labels=Feedback%3A+enhancement&template=feature_request.md) [日本語](https://github.com/team-apm/apm/issues/new?labels=Feedback%3A+enhancement&template=feature_request_ja.md)
- Bug Report [English](https://github.com/team-apm/apm/issues/new?labels=Problem%3A+bug&template=bug_report.md) [日本語](https://github.com/team-apm/apm/issues/new?labels=Problem%3A+bug&template=bug_report_ja.md)

Other Issues are also welcome.

We also welcome fundamental improvement issues, such as how to develop, how to separate code, data format specification, etc.

## Pull Requests

Pull Requests are also welcome.

We accept the following types of pull requests. **You do not need to open an issue first** for small bug fixes, dependency updates, documentation fixes, or refactors with limited scope.

If you have a question about a new feature, improvement, or fix, or if the impact of a major new feature or change is significant, please make an Issue to discuss it.

- Fixing a bug
- Adding a new feature
- Improve an existing feature
- Refactoring
- Fixing documentation

When the pull request is merged, your contribution will be added to the [Contributors list](https://github.com/team-apm/apm/graphs/contributors), and the [MIT License](./LICENSE) will be applied to the code content.

And after that, if you don't mind, add your name to the credits in [`src/renderer/about/About.tsx`](./src/renderer/about/About.tsx) and send a pull request.

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

```text
src/
├── common/          # Shared constants (IPC channel names)
├── lib/             # Shared libraries (config, paths, integrity, etc.)
├── main/            # Electron main process
├── migration/       # Data version migrations
├── renderer/
│   ├── about/       # About window (React)
│   ├── main/        # Main window (legacy DOM; being migrated)
│   └── splash/      # Splash screen
└── types/           # TypeScript declarations
```

See [BRANCHING.md](./BRANCHING.md) for branch workflow.

## Commit Message Convention

We are using Conventional Changelog, which is based on Angular's Commit Message Format.

- [conventional-changelog/packages/conventional-changelog-angular/README.md](https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog-angular/README.md)

The commit message is automatically checked by [commitlint](https://commitlint.js.org/) at commit time, and the commit will fail if it does not follow the conventions.

Since [release-it](https://github.com/release-it/release-it) is used to manage releases and changelogs, commits that contain new features or bug fixes should especially follow this convention.

### How to Commit

To simplify the generation of commit messages, [Commitizen](https://commitizen.github.io/cz-cli/) has been introduced.

Use `yarn cm` when committing.

After that, you can commit with a commit message that follows the conventions by typing as instructed in the console.

## Code Writing Style/Rules

This project has the following writing style/rules, but you may not need to worry too much about it since linting and formatting are automatically performed at commit time.

### Linting

We are using [ESLint](https://eslint.org/) for linting, and the settings are based on the [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html). The contents are as follows.

- ECMAScript 2022 can be used.
- Basically, use `const` / `let` to declare variables.
- Use ES `import` / `export` to load modules.
- Comment functions with JSDoc.

### Formatting

We are using [Prettier](https://prettier.io/) as the formatter.

The settings to be applied are those written in [.editorconfig](./.editorconfig) and the use of single quotes.
