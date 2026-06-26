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
git branch -f v3 vX.Y.Z
git push -f origin v3
```

See [docs/RELEASING.md](./docs/RELEASING.md) for the full release process.
