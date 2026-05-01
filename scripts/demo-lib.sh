#!/usr/bin/env bash
# scripts/demo-lib.sh — helpers for scripts/demo.sh
# Sourced by demo.sh; no standalone execution.

# ---- yaml / service metadata --------------------------------------------

# True when auth.provider in irsforge.yaml is anything other than "demo".
# The demo profile short-circuits the auth service (JWTs are minted inline
# by the frontend/oracle); any other provider value means the auth service
# must run alongside Canton.
auth_enabled() {
  local provider
  provider="$(grep -A2 '^auth:' "$YAML" | grep 'provider:' | head -1 | awk '{print $2}')"
  [ -n "$provider" ] && [ "$provider" != "demo" ]
}

# Deploy mode switch: "dev" (default, watcher-based, used by `make demo`)
# or "prod" (used by the Docker image / hosted demo VPS — runs `npm run
# start` against prebuilt dist/, which is much lighter than tsx watch +
# next dev compile workers). Set IRSFORGE_DEPLOY_MODE=prod in the
# container's ENV; `scripts/demo.sh start` reads this to pick the
# launch command for auth/oracle/app.
deploy_mode() {
  echo "${IRSFORGE_DEPLOY_MODE:-dev}"
}

# Launch command for node services (auth/oracle/app) — varies by deploy
# mode. Prod assumes `make build` has run; dev re-uses watchers.
node_launch_cmd() {
  if [ "$(deploy_mode)" = "prod" ]; then
    echo "npm run start"
  else
    echo "npm run dev"
  fi
}

svc_port() {
  case "$1" in
    canton) echo 6865 ;;   # gRPC ledger API; JSON API listens on 7575 too
    auth)   echo 3002 ;;
    oracle) echo 3001 ;;
    app)    echo 3000 ;;
  esac
}

svc_health_url() {
  case "$1" in
    auth)   echo "http://localhost:3002/.well-known/jwks.json" ;;
    oracle) echo "http://localhost:3001/api/health" ;;
    app)    echo "http://localhost:3000" ;;
    canton) echo "" ;;     # tcp-only check
  esac
}

# Narrow patterns used by `pkill -f` as the fallback when the PID file is
# missing or stale. Chosen to match ONLY the processes this script would
# have started itself — unrelated node/daml work is left untouched.
#
# macOS `pkill(1)` uses ERE, so alternation is a bare `|` and grouping is
# bare `()`. Leading `/` anchors to a path separator so these don't collide
# with unrelated matches (e.g. `oauth/src/index` can never match).
svc_pattern() {
  case "$1" in
    canton) echo "daml start" ;;
    auth)   echo "/auth/(src|dist)/index" ;;
    oracle) echo "/oracle/(src|dist)/index" ;;
    app)    echo "next (dev|start)" ;;
  esac
}

# ---- pid / probe helpers ------------------------------------------------

pid_file() { echo "$PID_DIR/$1.pid"; }
log_file() { echo "$LOG_DIR/$1.log"; }

pid_of() {
  local f
  f="$(pid_file "$1")"
  [ -f "$f" ] && cat "$f" 2>/dev/null || echo ""
}

is_alive() {
  local pid="${1:-}"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

# Poll a TCP port until it accepts connections or timeout (seconds) elapses.
# Uses bash's /dev/tcp pseudo-device so no netcat dependency is required.
wait_tcp() {
  local host="$1" port="$2" timeout="${3:-60}"
  local deadline=$(( SECONDS + timeout ))
  while (( SECONDS < deadline )); do
    if (exec 3<>"/dev/tcp/$host/$port") 2>/dev/null; then
      exec 3>&- 2>/dev/null || true
      return 0
    fi
    sleep 1
  done
  return 1
}

# Poll an HTTP endpoint until it returns a 2xx or 3xx. Treats DNS/connection
# errors as "keep waiting" rather than fatal — the service may still be
# booting.
wait_http_2xx() {
  local url="$1" timeout="${2:-60}"
  local deadline=$(( SECONDS + timeout ))
  while (( SECONDS < deadline )); do
    local code
    code="$(curl -fs -o /dev/null -w '%{http_code}' --max-time 2 "$url" 2>/dev/null || echo "000")"
    if [[ "$code" =~ ^[23] ]]; then return 0; fi
    sleep 1
  done
  return 1
}

# Stop one service: SIGTERM the tracked PID, wait up to 10s, SIGKILL if
# still alive. If no PID file (or PID is stale / dead), fall back to a
# narrow pkill pattern so we still clean up orphaned processes from
# earlier runs or from `make dev`.
stop_service() {
  local svc="$1"
  local pidf
  pidf="$(pid_file "$svc")"
  local pid=""
  [ -f "$pidf" ] && pid="$(cat "$pidf" 2>/dev/null || echo "")"

  local killed=0
  if [ -n "$pid" ] && is_alive "$pid"; then
    echo "stopping $svc (pid $pid)"
    kill -TERM "$pid" 2>/dev/null || true
    local deadline=$(( SECONDS + 10 ))
    while (( SECONDS < deadline )) && is_alive "$pid"; do sleep 1; done
    if is_alive "$pid"; then
      echo "  $svc did not exit on SIGTERM; SIGKILL"
      kill -KILL "$pid" 2>/dev/null || true
    fi
    killed=1
  fi

  if [ "$killed" = 0 ]; then
    local pattern
    pattern="$(svc_pattern "$svc")"
    if pkill -f "$pattern" 2>/dev/null; then
      echo "stopping $svc (pkill fallback: $pattern)"
    fi
  fi

  rm -f "$pidf"
}

# ---- start helpers ------------------------------------------------------

# Refuse to launch a service when a foreign process already owns its port.
# Our own previously-started process is caught earlier in launch_service
# via the PID-file liveness check; this guards only the case where
# something outside demo.sh (e.g. a stray `npm run dev`) holds the port.
check_port_free() {
  local svc="$1" port="$2"
  local our_pid
  our_pid="$(pid_of "$svc")"
  if is_alive "$our_pid"; then return 0; fi
  if (exec 3<>"/dev/tcp/localhost/$port") 2>/dev/null; then
    exec 3>&- 2>/dev/null || true
    echo "ERROR: port $port is already in use by a process not tracked by demo.sh." >&2
    echo "       Stop the foreign process or run 'scripts/demo.sh stop' first." >&2
    return 1
  fi
  return 0
}

# launch_service <name> <working-dir> <command>
# Backgrounds the command under nohup, writes stdout+stderr to the service
# log, records the PID. Idempotent: if a live PID file already exists for
# the service we consider it already running and return 0.
launch_service() {
  local name="$1" wd="$2" cmd="$3"
  local pidf logf
  pidf="$(pid_file "$name")"
  logf="$(log_file "$name")"
  if [ -f "$pidf" ] && is_alive "$(cat "$pidf" 2>/dev/null || echo "")"; then
    echo "$name already running (pid $(cat "$pidf"))"
    return 0
  fi
  echo "starting $name"
  (
    cd "$wd"
    nohup bash -c "$cmd" > "$logf" 2>&1 &
    echo $!
  ) > "$pidf"
  echo "  $name pid $(cat "$pidf"), log $logf"
}

# Wait for `daml start`'s init-script (Setup.Init:init in daml.yaml) to
# finish before returning. `wait-for-ledger.sh` only confirms port 6865
# is accepting TCP, but `daml start` uploads the DAR and runs the init
# script AFTER that — if we kick off our separate seed against the same
# ledger in between, both processes race to `allocatePartyWithHint
# "Operator"` and one of them dies with "Party already exists".
#
# Success signal: Setup.Init prints "IRSForge initialization complete" at
# the end. Failure signals: "Party already exists" / "Received ExitFailure"
# from daml-helper when the init script blows up.
wait_for_daml_init() {
  local logf="$1" timeout="${2:-180}"
  local deadline=$(( SECONDS + timeout ))
  while (( SECONDS < deadline )); do
    if [ -f "$logf" ]; then
      if grep -q 'IRSForge initialization complete' "$logf" 2>/dev/null; then return 0; fi
      if grep -qE 'Received ExitFailure|Party already exists' "$logf" 2>/dev/null; then return 1; fi
    fi
    sleep 1
  done
  return 1
}

# Run a readiness check; on failure, dump the last 30 lines of the
# service's log so the user sees why it hung.
probe_or_dump() {
  local svc="$1"; shift
  if "$@"; then return 0; fi
  echo "FAILED to reach ready state for $svc" >&2
  local logf
  logf="$(log_file "$svc")"
  if [ -f "$logf" ]; then
    echo "---- last 30 lines of $logf ----" >&2
    tail -n 30 "$logf" >&2
    echo "--------------------------------" >&2
  fi
  return 1
}
