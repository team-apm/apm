# Releasing apm

This project uses [release-it](https://github.com/release-it/release-it) with [@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog).

## Prerequisites

- Node.js 22 (22.22.2+ recommended; see `package.json` engines). Release CI also pins Node 22 because electron-forge 6.4.1 does not complete `make`/`publish` on Node 24 yet.
- Yarn 1.x
- `GITHUB_TOKEN` with permission to create releases (when publishing release notes to GitHub)
- Write access to this repository

## Steps

### 1. Prepare the release locally

Choose the semver bump:

```bash
yarn release:patch   # 3.9.1 → 3.9.2
yarn release:minor   # 3.9.1 → 3.10.0
yarn release:major   # 3.9.1 → 4.0.0
```

This will:

- Bump `package.json` version
- Update `CHANGELOG.md`
- Create a git commit and tag (`vX.Y.Z`)
- Create a **draft** GitHub Release titled `AviUtl Package Manager vX.Y.Z` with generated notes

`git.push` is disabled in `.release-it.json`. Push manually after verifying the commit and tag.

### 2. Push the tag

```bash
git push origin main
git push origin vX.Y.Z
```

### 3. Update the `v3` branch marker

The `v3` branch points at the latest v3 release tag:

```bash
git branch -f v3 vX.Y.Z
git push -f origin v3
```

### 4. CI publishes binaries

Pushing a `v*` tag triggers [`.github/workflows/release.yml`](../.github/workflows/release.yml), which runs `electron-forge publish` on macOS, Ubuntu, and Windows and attaches installers to the GitHub Release.

### 5. Publish the draft release

Review the draft release on GitHub, confirm artifacts are attached, then publish it.

## Commit message convention

Release notes are generated from [Conventional Commits](https://www.conventionalcommits.org/). Use `yarn cm` (Commitizen) for feature and fix commits.

## Troubleshooting

- If GitHub release creation fails, set `GITHUB_TOKEN` and retry, or create the release manually from `CHANGELOG.md`.
- If CI publish fails on one OS, check the workflow log; you may need to re-run the failed job after fixing the issue.
- If the draft release has no assets but CI is green, check that `release.yml` uses Node 22 and that `yarn make` completes locally (`Making distributables` / `Artifacts available` in the log). Node 24 can exit early during packaging with no error.
