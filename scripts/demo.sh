#!/usr/bin/env bash
# scripts/demo.sh — local orchestration for the IRSForge demo stack.
# Subcommands: start | stop | restart | status | logs <service>
#
# Design doc: docs/superpowers/specs/2026-04-19-demo-orchestration-script-design.md

set -euo pipefail

# Ensure the Daml SDK and a Java 17 runtime are on PATH / JAVA_HOME
# regardless of shell. The user's interactive fish/bash configs arrange
# this, but non-interactive invocations (CI, launchd, `bash scripts/demo.sh`)
# don't inherit that — Canton's sandbox needs both and fails with cryptic
# errors otherwise ("Unable to locate a Java Runtime"). Single source of
# truth is scripts/lib/daml-env.sh — overrides via IRSFORGE_DAML_HOME /
# IRSFORGE_JAVA_HOME.
# shellcheck source=lib/daml-env.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/daml-env.sh"

# ---- paths ---------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="$ROOT/.demo"
PID_DIR="$STATE_DIR/pids"
LOG_DIR="$STATE_DIR/logs"
YAML="$ROOT/irsforge.yaml"
mkdir -p "$PID_DIR" "$LOG_DIR"

# ---- load helpers -------------------------------------------------------

source "$SCRIPT_DIR/demo-lib.sh"

# ---- subcommand bodies -----------------------

DAML_QUIET="$SCRIPT_DIR/daml-quiet.sh"

build_prereqs() {
  # Prod mode (Docker image) bakes the build at image-build time — re-running
  # `make build` on every container start adds ~60s for no behavior change.
  # The cron-driven reset path needs to be fast (Tier 1 in deploy/), so skip
  # the rebuild and trust the image. Local `make demo` keeps the rebuild.
  if [ "$(deploy_mode)" = "prod" ]; then
    echo "skipping build prereqs (deploy mode = prod, artifacts baked into image)"
    return 0
  fi
  echo "building prereqs (shared-config, generated daml config, daml build, package-ids)..."
  ( cd "$ROOT" && make shared-config-build generate-daml-config )
  ( cd "$ROOT/contracts" && "$DAML_QUIET" build )
  ( cd "$ROOT" && make gen-package-ids )
}

start_auth() {
  check_port_free auth 3002 || return 1
  launch_service auth "$ROOT/auth" "$(node_launch_cmd)"
  probe_or_dump auth wait_http_2xx "http://localhost:3002/.well-known/jwks.json" 60
}

start_canton() {
  check_port_free canton 6865 || return 1
  # --start-navigator=no skips the ~1 GB Daml Navigator JVM on port 7500;
  # IRSForge has its own Next.js UI on port 3000.
  # --json-api-option=--address=0.0.0.0 binds the JSON API to all interfaces
  # so the Docker host's Caddy can reach it via docker-proxy NAT (the
  # default 127.0.0.1 binding makes WS reverse-proxy fail with TCP RST
  # because docker-proxy traffic arrives on eth0, not loopback). Compose
  # publishes 7575 only on the host's 127.0.0.1, so this stays internal.
  local daml_args="start --start-navigator=no --json-api-option=--address=0.0.0.0"
  if auth_enabled; then
    daml_args="$daml_args --json-api-option=--auth=rs-256-jwks=http://localhost:3002/.well-known/jwks.json"
  fi
  local cmd="$DAML_QUIET $daml_args"
  launch_service canton "$ROOT/contracts" "$cmd"
  probe_or_dump canton bash "$SCRIPT_DIR/wait-for-ledger.sh" || return 1
  # Port 6865 open ≠ init-script done. Wait for the init-script's
  # ExitSuccess marker in the canton log before letting seed_demo race it.
  probe_or_dump canton wait_for_daml_init "$(log_file canton)" 180
}

seed_demo() {
  local marker="$STATE_DIR/seeded"
  local canton_pid
  canton_pid="$(cat "$(pid_file canton)" 2>/dev/null || echo "")"
  # Bind the marker to the canton pid that ran the seed. If canton was
  # killed without `demo.sh stop`, the marker survives but the in-memory
  # ledger does not — comparing pids detects that and triggers reseed.
  # Empty marker (legacy pre-pid-binding format) is also treated as stale.
  if [ -f "$marker" ]; then
    local seeded_pid
    seeded_pid="$(cat "$marker" 2>/dev/null || echo "")"
    if [ -n "$seeded_pid" ] && [ "$seeded_pid" = "$canton_pid" ]; then
      echo "seed skipped (marker matches canton pid $canton_pid; stop will clear it)"
      return 0
    fi
    echo "seed marker stale (saved=${seeded_pid:-<empty>} current=$canton_pid); reseeding"
    rm -f "$marker"
  fi
  echo "seeding demo data..."
  local seedlog="$LOG_DIR/seed.log"
  # daml SDK 2.10 frequently exits non-zero after a clean
  # CoordinatedShutdown even when the script itself succeeded — so we
  # mirror output to a log, ignore the exit code, and use the "Demo seed
  # complete" marker as the real success signal. DemoSeed's contract
  # creates aren't idempotent (DUPLICATE_CONTRACT_KEY on replay), which
  # is why we gate on the marker file above instead of re-running.
  set +e
  ( cd "$ROOT/contracts" && "$DAML_QUIET" script \
      --dar .daml/dist/irsforge-contracts-0.0.1.dar \
      --script-name Setup.DemoSeed:seed \
      --ledger-host localhost --ledger-port 6865 ) 2>&1 \
    | tee -a "$seedlog"
  set -e
  if ! grep -q 'Demo seed complete' "$seedlog"; then
    echo "FAILED: seed did not reach 'Demo seed complete' marker" >&2
    tail -n 30 "$seedlog" >&2
    return 1
  fi
  echo "$canton_pid" > "$marker"
}

start_oracle() {
  check_port_free oracle 3001 || return 1
  launch_service oracle "$ROOT/oracle" "$(node_launch_cmd)"
  probe_or_dump oracle wait_http_2xx "http://localhost:3001/api/health" 60
}

start_app() {
  check_port_free app 3000 || return 1
  launch_service app "$ROOT/app" "$(node_launch_cmd)"
  # Next.js cold compile can take 60-90s on first boot in dev mode; prod
  # mode (`next start` against prebuilt .next/) starts in <5s.
  probe_or_dump app wait_http_2xx "http://localhost:3000" 120
}

# Trigger lazy route compilation so the first human click doesn't pay the
# 1-3 min cold-compile penalty per route. Next.js compiles the route pattern
# (not per-orgId), so one org is enough. Runs sequentially in the background:
# Turbopack's compile workers each take ~1 GB of V8 heap, and 10 in parallel
# spike the macOS compressor enough to threaten the host. Sequential keeps
# peak memory bounded.
warm_routes() {
  local base="http://localhost:3000"
  local urls=(
    "$base/"
    "$base/api/config"
    "$base/org/goldman/login"
    "$base/org/goldman/blotter"
    "$base/org/goldman/csa"
    "$base/org/goldman/workspace"
  )
  (
    for url in "${urls[@]}"; do
      curl -s -o /dev/null "$url" || true
    done
  ) >/dev/null 2>&1 &
  echo "  warming routes in background (first click will be fast)"
}

cmd_start() {
  build_prereqs
  if auth_enabled; then start_auth; fi
  start_canton
  seed_demo
  start_oracle
  start_app
  warm_routes
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "$STATE_DIR/started-at"
  echo
  echo "IRSForge demo is up."
  echo "  Frontend:     http://localhost:3000"
  echo "  Oracle:       http://localhost:3001"
  if auth_enabled; then
    echo "  Auth:         http://localhost:3002"
  fi
  echo "  Canton JSON:  http://localhost:7575"
  echo "  Tail logs:    scripts/demo.sh logs <canton|oracle|app>"
}

cmd_stop() {
  for svc in app oracle canton auth; do
    if [ "$svc" = "auth" ] && ! auth_enabled; then continue; fi
    stop_service "$svc"
  done
  rm -f "$STATE_DIR/started-at" "$STATE_DIR/seeded"
}

cmd_restart() { cmd_stop; cmd_start; }

cmd_status() {
  local started_at=""
  [ -f "$STATE_DIR/started-at" ] && started_at="$(cat "$STATE_DIR/started-at")"
  if [ -n "$started_at" ]; then
    echo "IRSForge demo — last start: $started_at"
    echo
  fi
  printf "%-10s %-7s %-6s %-12s %s\n" SERVICE PID PORT STATE HEALTH
  for svc in canton auth oracle app; do
    local pid port url
    pid="$(pid_of "$svc")"
    port="$(svc_port "$svc")"
    url="$(svc_health_url "$svc")"

    if [ "$svc" = "auth" ] && ! auth_enabled; then
      printf "%-10s %-7s %-6s %-12s %s\n" "$svc" "-" "$port" "skipped" "(auth.provider=demo)"
      continue
    fi

    local state health
    if is_alive "$pid"; then
      state="running"
      if [ -n "$url" ]; then
        if curl -fs --max-time 2 "$url" >/dev/null 2>&1; then
          health="ok"
        else
          health="unhealthy"
        fi
      else
        if wait_tcp localhost "$port" 1 >/dev/null 2>&1; then
          health="tcp-ok"
        else
          health="no-tcp"
        fi
      fi
    else
      state="stopped"
      health="—"
      pid="-"
    fi
    printf "%-10s %-7s %-6s %-12s %s\n" "$svc" "$pid" "$port" "$state" "$health"
  done
}

cmd_logs() {
  local svc="${1:-}"
  if [ -z "$svc" ]; then
    echo "usage: scripts/demo.sh logs <canton|auth|oracle|app>" >&2
    exit 2
  fi
  local f
  f="$(log_file "$svc")"
  if [ ! -f "$f" ]; then
    echo "no log file for $svc at $f" >&2
    exit 1
  fi
  tail -n 100 -f "$f"
}

# ---- dispatch -----------------------------------------------------------

usage() {
  cat >&2 <<EOF
usage: scripts/demo.sh <command> [args]

commands:
  start            Build prereqs, launch all services, seed demo data.
  stop             Stop all services (reverse order of start).
  restart          Stop then start.
  status           Show per-service pid / port / alive / health.
  logs <service>   tail -f the log for one service (canton|auth|oracle|app).
EOF
  exit 2
}

main() {
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    start)   cmd_start   "$@" ;;
    stop)    cmd_stop    "$@" ;;
    restart) cmd_restart "$@" ;;
    status)  cmd_status  "$@" ;;
    logs)    cmd_logs    "$@" ;;
    -h|--help|help|"") usage ;;
    *) echo "unknown command: $cmd" >&2; usage ;;
  esac
}

main "$@"
