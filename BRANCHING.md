# Branching

## Active branches

| Branch | Purpose                                                                    |
| ------ | -------------------------------------------------------------------------- |
| `main` | Development head. Open pull requests target this branch.                   |
| `v3`   | Marker for the latest v3 release tag. Updated when a release is published. |

## Historical branches

| Branch     | Purpose                                 |
| ---------- | --------------------------------------- |
| `v1`, `v2` | Archived release lines. Reference only. |

## Release tags

Tags named `v*` mark releases. Pushing a tag triggers the [Release workflow](.github/workflows/release.yml) to build and publish installers for Windows, macOS, and Linux.

After publishing a release, update the `v3` marker:

```bash
git switch v3
git merge --ff-only vX.Y.Z
git push origin v3
```

Release tags are always cut on top of `main`, so this is a fast-forward and needs no force. `--ff-only` is there to fail loudly if `v3` has somehow diverged — handle that case deliberately rather than overwriting it.

See [docs/RELEASING.md](./docs/RELEASING.md) for the full release process.
