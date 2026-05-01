#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/irsforge.yaml"
OUT="$ROOT/site/src/sections/10-deploy/snippet.yaml"

# Extract the four top-level blocks shown in the deploy section.
# Uses awk to slice known sections — no YAML library dep.
awk '
  /^currencies:/ { in_block=1 }
  /^parties:/ { in_block=1 }
  /^rateFamilies:/ { in_block=1 }
  /^scheduler:/ { in_block=1 }
  /^[a-zA-Z]/ && !/^(currencies|parties|rateFamilies|scheduler):/ { in_block=0 }
  in_block { print }
' "$SRC" | head -40 > "$OUT"

echo "Wrote $(wc -l < "$OUT") lines to $OUT"
