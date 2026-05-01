#!/usr/bin/env bash
# Pre-flight: verify every eslint plugin imported by eslint.config.mjs is
# actually present in node_modules.
#
# Why this exists: the eslint config imports plugins by name. If a plugin
# is missing from node_modules (partial install, npm prune, branch switch
# with a stale lockfile), eslint --fix exits non-zero with an opaque
# "Cannot find package" trace that's easy to bypass with --no-verify
# instead of fixing. This script surfaces the real problem with a
# one-line remedy BEFORE lint-staged runs eslint, so the failure mode
# can't accumulate silently.
#
# Tracks the actual import statements rather than a hardcoded list so
# adding a plugin to the config also updates the guard.

set -euo pipefail

CONFIG="${REPO_ROOT:-$(git rev-parse --show-toplevel)}/eslint.config.mjs"
NODE_MODULES="${REPO_ROOT:-$(git rev-parse --show-toplevel)}/node_modules"

[ -f "$CONFIG" ] || { echo "verify-eslint-plugins: $CONFIG not found"; exit 1; }
[ -d "$NODE_MODULES" ] || { echo "verify-eslint-plugins: $NODE_MODULES missing — run 'npm install'"; exit 1; }

# Extract `from '<package>'` for any package whose name suggests an eslint
# plugin (eslint-plugin-*, @next/eslint-plugin-*, typescript-eslint).
PLUGINS=$(grep -oE "from '(@[a-z-]+/)?eslint-plugin-[a-z-]+|from 'typescript-eslint'" "$CONFIG" \
  | sed -E "s/^from '//; s/'$//" \
  | sort -u)

MISSING=()
for p in $PLUGINS; do
  [ -d "$NODE_MODULES/$p" ] || MISSING+=("$p")
done

if [ "${#MISSING[@]}" -gt 0 ]; then
  echo "verify-eslint-plugins: missing from node_modules:"
  for p in "${MISSING[@]}"; do
    echo "  ✗ $p"
  done
  echo
  echo "  → Run 'npm install' from the repo root to restore."
  echo "  Why this matters: eslint silently fails to load when a configured"
  echo "  plugin is missing, which lets lint signal accumulate undetected."
  exit 1
fi

exit 0
