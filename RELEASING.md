# Releasing apm

This project uses [release-it](https://github.com/release-it/release-it) with [@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog).

## Prerequisites

- Node.js 24 or 22 (see `package.json` engines). Release CI uses Node 24.
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
git switch v3
git merge --ff-only vX.Y.Z
git push origin v3
```

Release tags are always cut on top of `main`, so this is a fast-forward and needs no force. `--ff-only` is there to fail loudly if `v3` has somehow diverged — handle that case deliberately rather than overwriting it.

### 4. CI publishes binaries

Pushing a `v*` tag triggers [`.github/workflows/release.yml`](../.github/workflows/release.yml), which runs `electron-forge publish` on macOS, Ubuntu, and Windows and attaches installers to the GitHub Release.

### 5. Publish the draft release

Review the draft release on GitHub, confirm artifacts are attached, then publish it.

## Commit message convention

Release notes are generated from [Conventional Commits](https://www.conventionalcommits.org/). Use `yarn cm` (Commitizen) for feature and fix commits.

## Troubleshooting

- If GitHub release creation fails, set `GITHUB_TOKEN` and retry, or create the release manually from `CHANGELOG.md`.
- If CI publish fails on one OS, check the workflow log; you may need to re-run the failed job after fixing the issue.
- If the draft release has no assets but CI is green, check that `yarn make` completes locally (`Making distributables` / `Artifacts available` in the log). Packaging can exit early with no error at all — on Node 24.16 / 24.17 this happens because of a broken `yauzl@2` inside `extract-zip` (electron/forge#4277). The `resolutions` entry in `package.json` works around it; make sure the install actually applied it.
