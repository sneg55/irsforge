#!/usr/bin/env bash
# scripts/reset-demo.sh — wipe + reseed the shared demo ledger.
#
# Tier 1 of the shared-demo coordination model (see deploy/README.md):
#   - This script is called by host cron (deploy/etc/cron.d/irsforge-reset)
#     on the demo VPS to bring the in-memory Canton sandbox back to a
#     known clean state on a regular cadence.
#   - The SPA reads platform.demoReset from /api/config and renders a
#     countdown banner so users know a reset is coming (Tier 2, see
#     app/src/shared/layout/demo-reset-banner.tsx).
#
# Implementation note: full `demo.sh restart` is the safest reset because
# Canton's in-memory state, the seed marker, oracle's WebSocket streams,
# and the auth service's per-startup key material are all coupled at
# startup. A partial canton-only restart leaves oracle subscribed to
# now-dead contract IDs and the mark-publisher loop pinned to a service
# account that no longer exists post-reseed. Full restart is ~30-60s of
# downtime; the banner countdown gives users notice.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$ROOT/.demo/logs"
mkdir -p "$LOG_DIR"

log() {
  printf '[%s] reset-demo: %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" \
    | tee -a "$LOG_DIR/reset.log"
}

log "starting reset cycle"

# Run from repo root so demo.sh's path resolution works regardless of
# what cwd cron handed us.
cd "$ROOT"

if ! "$SCRIPT_DIR/demo.sh" restart >> "$LOG_DIR/reset.log" 2>&1; then
  log "demo.sh restart FAILED — see $LOG_DIR/reset.log"
  exit 1
fi

log "reset cycle complete"
