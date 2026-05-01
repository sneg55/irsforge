#!/usr/bin/env bash
# Poll Canton's gRPC ledger API (port 6865) until it accepts connections, then
# exit 0. Used by `make demo` so the post-dev seed step blocks on ledger
# readiness instead of relying on a fixed `sleep`. Times out after 120s.
set -euo pipefail

HOST="${LEDGER_HOST:-localhost}"
PORT="${LEDGER_PORT:-6865}"
DEADLINE=$(( SECONDS + 120 ))

printf "Waiting for Canton ledger at %s:%s" "$HOST" "$PORT" >&2
while (( SECONDS < DEADLINE )); do
  if (exec 3<>/dev/tcp/"$HOST"/"$PORT") 2>/dev/null; then
    exec 3>&- 2>/dev/null || true
    printf " ready (%ds).\n" "$SECONDS" >&2
    exit 0
  fi
  printf "." >&2
  sleep 2
done

printf "\nerror: ledger at %s:%s not ready after 120s\n" "$HOST" "$PORT" >&2
exit 1
