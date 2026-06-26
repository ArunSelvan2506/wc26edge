#!/usr/bin/env bash
# One-command deploy: build the Vite app and publish dist/ to the gh-pages branch.
# Uses a throwaway git worktree so your current branch / working tree are untouched.
#   npm run deploy
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ Building…"
npm run build

BRANCH=gh-pages
WT="$(mktemp -d)"
cleanup() { git worktree remove --force "$WT" 2>/dev/null || true; }
trap cleanup EXIT

echo "▶ Preparing $BRANCH worktree…"
git fetch origin "$BRANCH" 2>/dev/null || true
if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git worktree add --force -B "$BRANCH" "$WT" "origin/$BRANCH"
else
  git worktree add --force -B "$BRANCH" "$WT"   # first deploy: new branch
fi

echo "▶ Publishing dist/ …"
# wipe everything except .git, then drop the fresh build in
find "$WT" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -r dist/. "$WT"/
touch "$WT/.nojekyll"

cd "$WT"
git add -A
if git diff --cached --quiet; then
  echo "✓ No changes to deploy."
  exit 0
fi
git commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"

echo "▶ Pushing…"
for i in 1 2 3 4; do
  if git push origin "$BRANCH"; then echo "✓ Deployed to $BRANCH."; exit 0; fi
  echo "  push failed, retry $i…"; sleep $((2 ** i))
done
echo "✗ Push failed after retries." >&2
exit 1
