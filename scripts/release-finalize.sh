#!/usr/bin/env bash
set -euo pipefail

# Colors and emojis for nice output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}🏁 Namespace Actions Toolkit - Finalize Release${NC}"
echo "================================================="
echo ""

# Parse arguments
VERSION=""
for arg in "$@"; do
  case $arg in
    --tag=*)
      VERSION="${arg#*=}"
      shift
      ;;
  esac
done

# Validate version was provided
if [ -z "$VERSION" ]; then
  echo -e "${RED}❌ Error: Version tag is required.${NC}"
  echo "   Usage: pnpm run release:finalize --tag=X.Y.Z"
  echo "   Example: pnpm run release:finalize --tag=0.2.2"
  exit 1
fi

# Strip leading 'v' if present
VERSION="${VERSION#v}"

echo -e "${BLUE}🎯 Finalizing release: v${VERSION}${NC}"
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
  echo "   Please commit or stash your changes before finalizing the release."
  git status --short
  exit 1
fi
echo -e "${GREEN}✅ No uncommitted changes${NC}"

# Switch to main branch if not already there
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo -e "${BLUE}🔀 Switching to main branch...${NC}"
  git checkout main
fi
echo -e "${GREEN}✅ On main branch${NC}"

# Pull latest changes
echo -e "${BLUE}📡 Pulling latest changes from origin/main...${NC}"
git pull origin main --quiet
echo -e "${GREEN}✅ Pulled latest changes${NC}"

# Validate version matches package.json
PACKAGE_VERSION=$(node -p "require('./package.json').version")
if [ "$VERSION" != "$PACKAGE_VERSION" ]; then
  echo -e "${RED}❌ Error: Version mismatch.${NC}"
  echo "   Provided version: ${VERSION}"
  echo "   package.json version: ${PACKAGE_VERSION}"
  echo ""
  echo "   Make sure the release PR has been merged and you're using the correct version."
  exit 1
fi
echo -e "${GREEN}✅ Version ${VERSION} matches package.json${NC}"

echo ""
echo -e "${YELLOW}⚠️  This will:${NC}"
echo "   1. Create tag v${VERSION}"
echo "   2. Push the tag to origin"
echo "   3. Wait for the tag to be visible on GitHub"
echo "   4. Create the GitHub Release with auto-generated notes"
echo ""

read -p "🤔 Do you want to continue? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}👋 Release finalization cancelled.${NC}"
  exit 0
fi

echo ""

# Check if tag already exists locally
if git rev-parse "v${VERSION}" >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  Tag v${VERSION} already exists locally.${NC}"
  
  # Check if it exists on remote
  if git ls-remote --tags origin | grep -q "refs/tags/v${VERSION}$"; then
    echo -e "${GREEN}✅ Tag v${VERSION} already exists on remote.${NC}"
  else
    echo -e "${BLUE}🚀 Pushing existing tag to origin...${NC}"
    git push origin "v${VERSION}"
    echo -e "${GREEN}✅ Tag pushed to origin${NC}"
  fi
else
  # Create and push the tag
  echo -e "${BLUE}🏷️  Creating tag v${VERSION}...${NC}"
  git tag "v${VERSION}"
  echo -e "${GREEN}✅ Tag v${VERSION} created${NC}"

  echo -e "${BLUE}🚀 Pushing tag to origin...${NC}"
  git push origin "v${VERSION}"
  echo -e "${GREEN}✅ Tag pushed to origin${NC}"
fi

# Wait for tag to be visible on GitHub
echo -e "${BLUE}⏳ Waiting for tag to be visible on GitHub...${NC}"
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if gh api "repos/{owner}/{repo}/git/refs/tags/v${VERSION}" --silent 2>/dev/null; then
    echo -e "${GREEN}✅ Tag v${VERSION} is visible on GitHub${NC}"
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
    echo -e "   Attempt ${ATTEMPT}/${MAX_ATTEMPTS} - waiting 2 seconds..."
    sleep 2
  fi
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
  echo -e "${YELLOW}⚠️  Timed out waiting for tag visibility. The tag may still be propagating.${NC}"
  echo "   You can check manually at: https://github.com/namespacelabs/nscloud-actions-toolkit/tags"
fi

# Create GitHub Release
echo -e "${BLUE}📦 Creating GitHub Release...${NC}"
gh release create "v${VERSION}" --generate-notes
echo -e "${GREEN}✅ GitHub Release created${NC}"

echo ""
echo -e "${GREEN}🎉 Release v${VERSION} finalized!${NC}"
echo ""
