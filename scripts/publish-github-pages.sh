#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${GITHUB_PAGES_REPO:-stone-atmosphere}"
OWNER="${GITHUB_OWNER:-mahira-tahir}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Run: gh auth login"
  exit 1
fi

if git remote get-url github >/dev/null 2>&1; then
  git remote set-url github "https://github.com/${OWNER}/${REPO_NAME}.git"
else
  git remote add github "https://github.com/${OWNER}/${REPO_NAME}.git"
fi

if ! gh repo view "${OWNER}/${REPO_NAME}" >/dev/null 2>&1; then
  gh repo create "${REPO_NAME}" --public \
    --description "Атмосфера камня — static site" \
    --source="$ROOT" \
    --remote=github \
    --push
else
  git push -u github main
fi

gh api -X POST "repos/${OWNER}/${REPO_NAME}/pages" \
  -f build_type=legacy \
  -f "source[branch]=main" \
  -f "source[path]=/" \
  2>/dev/null || true

echo ""
echo "Site (after build): https://${OWNER}.github.io/${REPO_NAME}/"
echo "If 404, open Settings → Pages and confirm branch main, folder /."
