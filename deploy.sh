#!/bin/bash
# Deploy the static site to GitHub Pages.
# Usage: bash deploy.sh [commit_message]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

COMMIT_MSG="${1:-Update academic homepage: $(date '+%Y-%m-%d %H:%M')}"

echo "Qi Sun Academic Homepage - deploy to GitHub Pages"
echo "================================================="

if [ ! -d ".git" ]; then
  echo ""
  echo "Initializing Git repository..."
  git init
  git checkout -b main
  echo ""
  echo "Please add a remote repository first:"
  echo "  git remote add origin git@github.com:YOUR_USERNAME/YOUR_USERNAME.github.io.git"
  echo ""
  echo "Then run this script again."
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "No remote repository is configured. Run:"
  echo "  git remote add origin git@github.com:YOUR_USERNAME/YOUR_USERNAME.github.io.git"
  exit 1
fi

echo ""
echo "Committing changes..."
git add -A
git commit -m "$COMMIT_MSG" --allow-empty 2>/dev/null || true

echo ""
echo "Pushing to GitHub..."
git push origin main

echo ""
echo "Deploy finished."
echo ""
echo "GitHub Pages setup:"
echo "  1. Open repository Settings > Pages."
echo "  2. Choose 'Deploy from a branch'."
echo "  3. Choose branch 'main' and folder '/ (root)'."
echo "  4. Save and wait a few minutes."
echo ""
echo "Expected site URL:"
REMOTE_URL=$(git remote get-url origin)
if [[ "$REMOTE_URL" == *"github.com"* ]]; then
  USERNAME=$(echo "$REMOTE_URL" | sed -E 's/.*github.com[:/]([^/]+).*/\1/')
  REPO_NAME=$(echo "$REMOTE_URL" | sed -E 's/.*\/([^/.]+)(\.git)?$/\1/')
  if [ "$REPO_NAME" = "${USERNAME}.github.io" ]; then
    echo "  https://${USERNAME}.github.io/"
  else
    echo "  https://${USERNAME}.github.io/${REPO_NAME}/"
  fi
fi
