#!/usr/bin/env bash
#
# Phase 0 Step 5 — Hardcoded-config regression guard.
#
# Fails if any of the values that Phase 0 moved into YAML creep back into
# source. Keep this list NARROW: each entry must be a specific regression
# we've already seen, not speculative "what if someone hardcodes X" coverage.
# Noisy guards get ignored; targeted guards get obeyed.
#
# Runs via `make lint-hardcodes`; suitable for CI. Uses plain grep + find so
# it has no dependency on ripgrep.

set -euo pipefail

cd "$(dirname "$0")/.."

FAIL=0

# Common file-set filter: source files we care about, excluding generated /
# vendored / test / demo-fixture paths. Stored as find-expression pieces.
exclude_paths() {
  find "$1" -type f \
    -not -path '*/node_modules/*' \
    -not -path '*/.next/*' \
    -not -path '*/dist/*' \
    -not -path '*/.daml/*' \
    -not -path '*/__tests__/*' \
    -not -name '*.test.ts' -not -name '*.test.tsx' \
    -not -name '*.test.js' -not -name '*.test.jsx' \
    "${@:2}"
}

# ---------------------------------------------------------------------------
# Guard 1: the killed frontend currency-list file must not reappear.
# Step 2 deleted this file after moving the G10 array to YAML via
# useCurrencyOptions(). If someone re-adds it, the UI silently drifts from
# on-chain again.
# ---------------------------------------------------------------------------
KILLED_CURRENCY_FILE="app/src/features/workspace/constants/currencies.ts"
if [ -e "$KILLED_CURRENCY_FILE" ]; then
  echo "[lint-hardcodes] FAIL: $KILLED_CURRENCY_FILE reappeared."
  echo "  It was deleted in Phase 0 Step 2. Currencies must flow through"
  echo "  useCurrencyOptions() (sourced from /api/config) — do not re-hardcode."
  FAIL=1
fi

# ---------------------------------------------------------------------------
# Guard 2: CDS reference name "TSLA" must not appear in runtime source.
# It lives in irsforge.yaml (cds.referenceNames) and in DemoSeed.daml (a
# demo-only Daml Script that production never runs). Anywhere else is a
# regression of Phase 0 Step 1.
#
# Allowed locations:
#   - irsforge.yaml (canonical source)
#   - docs/** (documentation)
#   - contracts/src/Setup/DemoSeed.daml (deferred; see phase-0 plan)
#   - tests and __tests__/** (legitimate test fixtures)
#   - shared-config/scripts/** and scripts/** (tooling)
# ---------------------------------------------------------------------------
tsla_paths=()
while IFS= read -r f; do
  tsla_paths+=("$f")
done < <(
  exclude_paths app/src \( -name '*.ts' -o -name '*.tsx' \) \
    -exec grep -l 'TSLA' {} \; 2>/dev/null
  exclude_paths oracle/src \( -name '*.ts' \) \
    -exec grep -l 'TSLA' {} \; 2>/dev/null
  exclude_paths shared-config/src \( -name '*.ts' \) \
    -exec grep -l 'TSLA' {} \; 2>/dev/null
  exclude_paths auth/src \( -name '*.ts' \) \
    -exec grep -l 'TSLA' {} \; 2>/dev/null
)

if [ "${#tsla_paths[@]}" -gt 0 ]; then
  echo "[lint-hardcodes] FAIL: 'TSLA' appears in runtime source outside allowed locations:"
  for p in "${tsla_paths[@]}"; do
    echo "  $p"
  done
  echo
  echo "  CDS reference names live in irsforge.yaml (cds.referenceNames)."
  echo "  Read them via config rather than hardcoding."
  FAIL=1
fi

# ---------------------------------------------------------------------------
# Guard 3: CDS stub rate constants (DEFAULT_PROB / module-level RECOVERY)
# must not reappear in oracle source. They live in irsforge.yaml under
# demo.cdsStub.{defaultProb,recovery} (Phase 0 Step 4) and flow into the
# provider via its constructor.
# ---------------------------------------------------------------------------
stub_rate_hits=$(
  exclude_paths oracle/src -name '*.ts' \
    -exec grep -lE '^(const|let|var) +(DEFAULT_PROB|RECOVERY)' {} \; 2>/dev/null
)

if [ -n "$stub_rate_hits" ]; then
  echo "[lint-hardcodes] FAIL: CDS stub rate constants found in oracle source:"
  echo "$stub_rate_hits" | sed 's/^/  /'
  echo
  echo "  Stub rates live in irsforge.yaml (demo.cdsStub). The provider"
  echo "  constructor receives them — do not reintroduce module-level constants."
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "[lint-hardcodes] OK"
fi
exit "$FAIL"
