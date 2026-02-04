# 🚀 Releasing a New Version

This document describes the process for releasing a new version of `@namespacelabs/actions-toolkit`.

## Prerequisites

- You must be on the `main` branch
- Your local `main` must be up to date with `origin/main`
- No uncommitted changes in your working directory
- [GitHub CLI (`gh`)](https://cli.github.com/) installed (optional, but recommended)

## Quick Release

Run the release script:

```bash
pnpm run release
```

The script will guide you through the process interactively.

After the PR is merged, finalize the release:

```bash
pnpm run release:finalize --tag=X.Y.Z
```

This will create and push the tag, then provide a link to create the GitHub release.

## Manual Release Process

If you prefer to release manually, follow these steps:

### 1. 🔍 Pre-flight Checks

```bash
# Ensure you're on main and up to date
git checkout main
git pull origin main

# Verify no uncommitted changes
git status
```

### 2. 📝 Update Version

Edit `package.json` and update the `version` field:

```json
{
  "version": "X.Y.Z"
}
```

### 3. 🌿 Create Release Branch

```bash
# Create and checkout release branch
git checkout -b release-vX.Y.Z

# Commit the version bump
git add package.json
git commit -m "chore: bump version to vX.Y.Z"

# Push the branch
git push -u origin release-vX.Y.Z
```

### 4. 📬 Create Pull Request

Create a PR from `release-vX.Y.Z` to `main`:

```bash
gh pr create --title "🚀 Release vX.Y.Z" --base main
```

Or create it manually via the GitHub UI.

### 5. ✅ Merge the PR

After review, merge the PR into `main`.

### 6. 🏁 Finalize the Release

Run the finalize script to create and push the tag:

```bash
pnpm run release:finalize --tag=X.Y.Z
```

Or manually:

```bash
git checkout main
git pull origin main
git tag vX.Y.Z
git push origin vX.Y.Z
```

### 7. 📦 Create GitHub Release

1. Go to [Releases](https://github.com/namespacelabs/nscloud-actions-toolkit/releases/new)
2. Select the tag `vX.Y.Z`
3. Click "Generate release notes" to auto-generate notes from commits
4. Review and edit the release notes as needed
5. Click "Publish release"

### 8. 📦 Automatic NPM Publish

Once the GitHub release is published, the [publish workflow](.github/workflows/publish.yml) automatically:

1. Verifies the tag version matches `package.json`
2. Confirms the version isn't already published to NPM
3. Runs tests and builds the package
4. Publishes to NPM with public access

You can monitor the workflow progress in the [Actions tab](https://github.com/namespacelabs/nscloud-actions-toolkit/actions/workflows/publish.yml).

## Versioning Guidelines

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (`X.0.0`): Breaking changes to the public API
- **MINOR** (`0.X.0`): New features, backward compatible
- **PATCH** (`0.0.X`): Bug fixes, backward compatible

### Pre-release Versions

For pre-release versions, use suffixes:

- `1.0.0-alpha.1` - Alpha release
- `1.0.0-beta.1` - Beta release
- `1.0.0-rc.1` - Release candidate

## Troubleshooting

### "You have uncommitted changes"

Commit or stash your changes before releasing:

```bash
git stash
# or
git commit -am "your message"
```

### "Local main is not up to date"

Pull the latest changes:

```bash
git pull origin main
```

### "You must be on the 'main' branch"

Switch to main:

```bash
git checkout main
```
