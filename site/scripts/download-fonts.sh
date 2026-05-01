#!/usr/bin/env bash
set -euo pipefail
# Vendors three variable woff2 fonts into site/public/fonts/. Re-run after bumping versions below.
cd "$(dirname "$0")/../public/fonts"

# Source Serif 4 — variable, OFL
curl -fsSL -o source-serif-4-variable.woff2 \
  "https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4:vf@5.2.9/latin-wght-normal.woff2"
if ! head -c 4 source-serif-4-variable.woff2 | grep -q "wOF2"; then echo "ERROR: source-serif-4 download is not woff2" >&2; exit 1; fi

# Inter — variable, OFL
curl -fsSL -o inter-variable.woff2 \
  "https://cdn.jsdelivr.net/fontsource/fonts/inter:vf@5.2.8/latin-wght-normal.woff2"
if ! head -c 4 inter-variable.woff2 | grep -q "wOF2"; then echo "ERROR: inter download is not woff2" >&2; exit 1; fi

# JetBrains Mono — variable, OFL
curl -fsSL -o jetbrains-mono-variable.woff2 \
  "https://cdn.jsdelivr.net/fontsource/fonts/jetbrains-mono:vf@5.2.8/latin-wght-normal.woff2"
if ! head -c 4 jetbrains-mono-variable.woff2 | grep -q "wOF2"; then echo "ERROR: jetbrains-mono download is not woff2" >&2; exit 1; fi

echo "Fonts downloaded."
