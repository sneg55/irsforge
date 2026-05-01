#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Build first if dist is missing
[ -d dist ] || npm run build

# Run linkinator on the static output. Skip outbound links to reduce CI noise.
npx linkinator dist \
  --recurse \
  --skip "https?://(?!localhost|irsforge\\.com)" \
  --silent
