#!/usr/bin/env bash
# deploy/entrypoint.sh — container entrypoint for the shared demo.
#
# Responsibilities:
#   1. Boot the demo stack via scripts/demo.sh start (prod mode).
#   2. Run the round-clock reset loop in the foreground so the container
#      stays alive AND drives the Tier 1 wipe-on-cadence behavior.
#   3. Forward SIGTERM to scripts/demo.sh stop on shutdown so Canton's
#      JVM gets a chance at coordinated shutdown (10s grace).
#
# The loop's reset cadence MUST match platform.demoReset.intervalMinutes
# in irsforge.yaml — the SPA banner reads the YAML value to compute the
# countdown and any drift between the two will display the wrong wait.

set -euo pipefail

INTERVAL_MIN="${IRSFORGE_RESET_INTERVAL_MINUTES:-60}"
INTERVAL_SEC=$(( INTERVAL_MIN * 60 ))

if (( INTERVAL_SEC < 60 )); then
  echo "entrypoint: IRSFORGE_RESET_INTERVAL_MINUTES=$INTERVAL_MIN is too small (<1 min)" >&2
  exit 1
fi

# Sanity-check: warn if the YAML disagrees with the reset cadence. Grep
# is brittle but the alternative (linking shared-config into a CLI just
# for this) is heavier than the failure mode (wrong banner countdown).
yaml_interval=$(awk '
  /^  demoReset:/ { in_dr=1; next }
  in_dr && /^  [a-zA-Z]/ { in_dr=0 }
  in_dr && $1 == "intervalMinutes:" { print $2; exit }
' /app/irsforge.yaml)
if [ -n "$yaml_interval" ] && [ "$yaml_interval" != "$INTERVAL_MIN" ]; then
  echo "entrypoint: WARNING — IRSFORGE_RESET_INTERVAL_MINUTES=$INTERVAL_MIN does not match irsforge.yaml platform.demoReset.intervalMinutes=$yaml_interval; SPA banner will count down to a boundary the loop will miss." >&2
fi

cleanup() {
  echo "entrypoint: SIGTERM received, stopping demo"
  /app/scripts/demo.sh stop || true
  exit 0
}
trap cleanup SIGTERM SIGINT

cd /app

# In prod-deploy mode every container start is a fresh boot — the
# Canton in-memory ledger is wiped, so a seed must run again. The
# `.demo/seeded` marker is keyed to canton's pid, but PID namespaces
# in containers are deterministic (canton always lands on the same pid
# across restarts). The marker therefore survives `restart: unless-stopped`
# cycles and incorrectly skips reseeding. Clear it unconditionally.
rm -f /app/.demo/seeded 2>/dev/null || true

echo "entrypoint: booting demo (deploy mode = prod)"
/app/scripts/demo.sh start

echo "entrypoint: reset loop active (every $INTERVAL_MIN min, round-clock aligned)"

while true; do
  now=$(date +%s)
  next=$(( (now / INTERVAL_SEC + 1) * INTERVAL_SEC ))
  wait_sec=$(( next - now ))
  echo "entrypoint: next reset in ${wait_sec}s ($(date -u -d @"$next" +'%Y-%m-%dT%H:%M:%SZ'))"
  sleep "$wait_sec"
  if ! /app/scripts/reset-demo.sh; then
    echo "entrypoint: reset failed; continuing on next interval" >&2
  fi
done
