#!/usr/bin/env bash
set -euo pipefail

# Colors and emojis for nice output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}🚀 Namespace Actions Toolkit - Release Script${NC}"
echo "================================================"
echo ""

# Check GitHub CLI is available
if ! command -v gh &> /dev/null; then
  echo -e "${RED}❌ Error: GitHub CLI (gh) is not installed.${NC}"
  echo "   Please install it from: https://cli.github.com/"
  exit 1
fi
echo -e "${GREEN}✅ GitHub CLI available${NC}"

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo -e "${RED}❌ Error: You have uncommitted changes.${NC}"
  echo "   Please commit or stash your changes before releasing."
  git status --short
  exit 1
fi
echo -e "${GREEN}✅ No uncommitted changes${NC}"

# Check we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo -e "${RED}❌ Error: You must be on the 'main' branch to release.${NC}"
  echo "   Current branch: $CURRENT_BRANCH"
  exit 1
fi
echo -e "${GREEN}✅ On main branch${NC}"

# Fetch latest and check we're up to date
echo -e "${BLUE}📡 Fetching latest changes from origin...${NC}"
git fetch origin main --quiet

LOCAL_HEAD=$(git rev-parse HEAD)
REMOTE_HEAD=$(git rev-parse origin/main)

if [ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]; then
  echo -e "${RED}❌ Error: Local main is not up to date with origin/main.${NC}"
  echo "   Please run 'git pull origin main' first."
  exit 1
fi
echo -e "${GREEN}✅ Up to date with origin/main${NC}"

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Parse current version and suggest next minor
IFS='.' read -r MAJOR MINOR PATCH <<< "${CURRENT_VERSION%%-*}"
SUGGESTED_VERSION="${MAJOR}.$((MINOR + 1)).0"

echo ""
echo -e "${YELLOW}📦 Current version: v${CURRENT_VERSION}${NC}"
echo ""

# Ask for new version
read -p "🔢 Enter the new semver version (e.g., ${SUGGESTED_VERSION}): " NEW_VERSION

# Validate semver format
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
  echo -e "${RED}❌ Error: Invalid semver format.${NC}"
  echo "   Expected format: MAJOR.MINOR.PATCH (e.g., 1.0.0, 0.2.0-beta.1)"
  exit 1
fi

# Check that new version is greater than current version
version_gt() {
  local v1="${1%%-*}" v2="${2%%-*}"
  IFS='.' read -r v1_major v1_minor v1_patch <<< "$v1"
  IFS='.' read -r v2_major v2_minor v2_patch <<< "$v2"
  
  if (( v1_major > v2_major )); then return 0; fi
  if (( v1_major < v2_major )); then return 1; fi
  if (( v1_minor > v2_minor )); then return 0; fi
  if (( v1_minor < v2_minor )); then return 1; fi
  if (( v1_patch > v2_patch )); then return 0; fi
  return 1
}

if ! version_gt "$NEW_VERSION" "$CURRENT_VERSION"; then
  echo -e "${RED}❌ Error: New version (${NEW_VERSION}) must be greater than current version (${CURRENT_VERSION}).${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}⚠️  This will:${NC}"
echo "   1. Update package.json to version ${NEW_VERSION}"
echo "   2. Create branch: release-v${NEW_VERSION}"
echo "   3. Commit the version bump"
echo "   4. Push the branch and create a PR on GitHub"
echo ""
echo -e "${YELLOW}📌 After merging the PR, you will need to:${NC}"
echo "   1. Create and push a tag: git tag v${NEW_VERSION} && git push origin v${NEW_VERSION}"
echo "   2. Create a release through the GitHub UI"
echo ""

read -p "🤔 Do you want to continue? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}👋 Release cancelled.${NC}"
  exit 0
fi

echo ""
echo -e "${BLUE}📝 Updating package.json...${NC}"

# Update version in package.json using node
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
pkg.version = '${NEW_VERSION}';
fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
"

echo -e "${GREEN}✅ Updated package.json to v${NEW_VERSION}${NC}"

# Create release branch
BRANCH_NAME="release-v${NEW_VERSION}"
echo -e "${BLUE}🌿 Creating branch: ${BRANCH_NAME}${NC}"
git checkout -b "$BRANCH_NAME"

# Commit the change
echo -e "${BLUE}💾 Committing version bump...${NC}"
git add package.json
git commit -m "chore: bump version to v${NEW_VERSION}"

# Push the branch
echo -e "${BLUE}🚀 Pushing branch to origin...${NC}"
git push -u origin "$BRANCH_NAME"

# Create PR using GitHub CLI
echo -e "${BLUE}📬 Creating Pull Request...${NC}"
PR_BODY="## 🚀 Release v${NEW_VERSION}

This PR prepares the release of version ${NEW_VERSION}.

### ✅ Checklist after merging:

1. **Create the tag:**
   \`\`\`bash
   git checkout main
   git pull origin main
   git tag v${NEW_VERSION}
   git push origin v${NEW_VERSION}
   \`\`\`

2. **Create a GitHub Release:**
   - Go to [Releases](../../releases/new)
   - Select tag \`v${NEW_VERSION}\`
   - Generate release notes
   - Publish the release

### 📦 Changes
- Bumps version from \`${CURRENT_VERSION}\` to \`${NEW_VERSION}\`
"
gh pr create \
  --title "🚀 Release v${NEW_VERSION}" \
  --body "$PR_BODY" \
  --base main

echo ""
echo -e "${GREEN}🎉 Success! PR created for release v${NEW_VERSION}${NC}"

echo ""
echo -e "${GREEN}✨ Done! Next steps:${NC}"
echo "   1. Review and merge the PR"
echo "   2. Create and push the tag:"
echo "      git checkout main && git pull origin main"
echo "      git tag v${NEW_VERSION} && git push origin v${NEW_VERSION}"
echo "   3. Create a release through the GitHub UI"
echo ""
