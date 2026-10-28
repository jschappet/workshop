#!/usr/bin/env bash
set -euo pipefail

# Usage: ./upload.sh [commit message / new PR title]
# Stages all non-ignored changes. Review `git status` before running.
cd "$(dirname "${BASH_SOURCE[0]}")"
for tool in git gh npm; do
  command -v "$tool" >/dev/null || { echo "Required command not found: $tool" >&2; exit 1; }
done
gh auth status >/dev/null
branch=$(git symbolic-ref --quiet --short HEAD) || {
  echo "Check out a branch before running upload.sh." >&2
  exit 1
}
base=$(gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name')
if [[ -z "$base" || "$base" == "null" ]]; then
  echo "Unable to determine the repository's default branch." >&2
  exit 1
fi
message="${*:-Update site}"

echo "Building site…"
npm run build
git fetch origin "$base"
if [[ "$branch" == "$base" ]]; then
  branch="codex/site-update-$(date -u +%Y%m%d-%H%M%S)-$$"
  git switch -c "$branch"
fi

git add -A
if ! git diff --cached --quiet; then
  git commit -m "$message"
else
  echo "No uncommitted changes; checking for existing branch commits."
fi
if [[ "$(git rev-list --count "origin/$base..HEAD")" == "0" ]]; then
  echo "No commits to submit against $base."
  exit 0
fi

git push --set-upstream origin "$branch"
pr_url=$(gh pr list --head "$branch" --base "$base" --state open --json url --jq '.[0].url // empty')
if [[ -n "$pr_url" ]]; then
  echo "Updated existing PR: $pr_url"
else
  gh pr create --base "$base" --head "$branch" --title "$message" --fill
fi
