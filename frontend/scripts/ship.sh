#!/usr/bin/env bash
# ship.sh — One command: branch → commit → push → PR → (optional merge)
#
# Usage:
#   bash scripts/ship.sh "fix: broken auth check"          # create PR
#   bash scripts/ship.sh "fix: broken auth check" --merge   # create PR + squash merge
#   bash scripts/ship.sh --merge                            # merge current PR (no new commit)

set -euo pipefail

MERGE=false
MSG=""

# Parse args
for arg in "$@"; do
  if [ "$arg" = "--merge" ]; then
    MERGE=true
  elif [ -z "$MSG" ]; then
    MSG="$arg"
  fi
done

# If --merge only (no message), just merge current branch's PR
if [ "$MERGE" = true ] && [ -z "$MSG" ]; then
  PR_NUM=$(gh pr view --json number -q .number 2>/dev/null || true)
  if [ -z "$PR_NUM" ]; then
    echo "ERROR: No open PR for current branch"
    exit 1
  fi
  echo "Squash merging PR #${PR_NUM}..."
  gh pr merge "$PR_NUM" --squash --delete-branch
  exit 0
fi

if [ -z "$MSG" ]; then
  echo "Usage: bash scripts/ship.sh \"commit message\" [--merge]"
  exit 1
fi

# Check for changes
if [ -z "$(git status --porcelain)" ]; then
  echo "ERROR: No changes to commit"
  exit 1
fi

# Extract prefix for branch name (fix/feat/chore/refactor)
PREFIX=$(echo "$MSG" | grep -o '^[a-z]*' || echo "feat")
# Slugify: take first 5 words after prefix
SLUG=$(echo "$MSG" | sed 's/^[a-z]*[:(]*//' | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | head -c 50 | sed 's/-$//')
BRANCH="${PREFIX}/${SLUG}"

# Create branch
CURRENT=$(git branch --show-current)
if [ "$CURRENT" = "main" ] || [ "$CURRENT" = "master" ]; then
  git checkout -b "$BRANCH"
else
  BRANCH="$CURRENT"
fi

# Stage + commit
git add -A
git commit -m "$MSG"

# Push
git push -u origin "$BRANCH" 2>&1

# Create PR
TITLE=$(echo "$MSG" | head -c 70)
PR_URL=$(gh pr create --title "$TITLE" --body "$(cat <<EOF
## Summary
${MSG}

## Test plan
- [ ] \`tsc --noEmit\` clean
- [ ] \`npx vitest run\` passes
EOF
)" 2>&1 | tail -1)

echo ""
echo "PR created: $PR_URL"

# Auto-merge if requested
if [ "$MERGE" = true ]; then
  PR_NUM=$(echo "$PR_URL" | grep -o '[0-9]*$')
  echo "Waiting for CI..."
  sleep 3
  gh pr merge "$PR_NUM" --squash --delete-branch
  echo "Merged."
fi
