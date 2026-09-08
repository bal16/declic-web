#!/usr/bin/env bash
#
# Build a C1 mirror branch for one app (ADR-001, docs/adr/ADR-001-monorepo-mirror.md).
#
# A C1 mirror is a standalone-buildable slice of the monorepo: the app plus
# the shared packages it needs, kept at identical relative paths so the same
# build commands work in the mirror as in the monorepo:
#
#   declic-web    = apps/web    + packages/contracts packages/db packages/tsconfig
#   declic-api    = apps/api    + packages/contracts packages/db packages/tsconfig
#   declic-worker = apps/worker + packages/contracts packages/db packages/tsconfig
#
# plus the root build manifest (package.json, bunfig.toml, bun.lock, .gitignore).
#
# Usage:   bash scripts/mirror.sh <web|api|worker>
# Result:  local branch mirror-<app>, ready to push:
#          git push --force git@github.com:bal16/declic-<app>.git mirror-<app>:main
#
# The branch is rebuilt from scratch on every run, so mirrors never accumulate
# monorepo history — they are generated artifacts, never edited by hand.
# Only core git is used (no filter-repo, no subtree); works on Linux and macOS.

set -euo pipefail

# Step 1: validate the app argument (exactly one of web|api|worker).
APP="${1:?usage: bash scripts/mirror.sh <web|api|worker>}"
case "$APP" in
  web|api|worker) ;;
  *) echo "error: unknown app '$APP' (want: web|api|worker)" >&2; exit 1 ;;
esac

BRANCH="mirror-$APP"
SOURCE_REF="${SOURCE_REF:-main}"

# Step 2: verify the source ref exists before touching any branch.
git rev-parse --verify --quiet "$SOURCE_REF" >/dev/null \
  || { echo "error: source ref '$SOURCE_REF' not found" >&2; exit 1; }

# Step 3: refuse to run with uncommitted work around
# (git rm would abort on locally modified files, leaving a half-built branch).
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "error: working tree has uncommitted changes — commit or stash first" >&2
  exit 1
fi

# Step 4: return to the original branch when done (no-op on detached HEAD, e.g. CI).
RETURN_TO="$(git branch --show-current || true)"
if [ -n "$RETURN_TO" ]; then
  trap 'git checkout -q "$RETURN_TO"' EXIT
fi

# Step 5: rebuild the mirror branch from scratch on top of the source ref.
git checkout -q -B "$BRANCH" "$SOURCE_REF"

# Step 6: drop everything outside the C1 slice (pathspec negation, core git only).
git rm -q -r -- . \
  ":!apps/$APP" \
  ':!packages/contracts' \
  ':!packages/db' \
  ':!packages/tsconfig' \
  ':!package.json' \
  ':!bunfig.toml' \
  ':!bun.lock' \
  ':!.gitignore'

# Step 7: stamp the generated read-only README into the slice.
cat > README-mirror.md <<EOF
# declic-$APP (read-only mirror)

Generated artifact — **do not push here and do not edit here.**

Source of truth: \`bal16/declic\` (private monorepo).
This branch (\`$BRANCH\`) is rebuilt from \`$SOURCE_REF\` on every mirror run
(\`bash scripts/mirror.sh $APP\`, see \`docs/adr/ADR-001-monorepo-mirror.md\`).

Standalone build:

\`\`\`bash
bun install --frozen-lockfile
bun run --filter "@declic/$APP" build
\`\`\`
EOF
git add README-mirror.md

# Step 8: commit the slice and print the force-push command.
SOURCE_SHORT="$(git rev-parse --short "$SOURCE_REF")"
git commit -q -m "mirror: rebuild $APP slice from $SOURCE_REF ($SOURCE_SHORT)"

echo "branch $BRANCH ready."
echo "push with: git push --force git@github.com:bal16/declic-$APP.git $BRANCH:main"
