#!/usr/bin/env bash
# scripts/watchdog-memory.sh — kill the demo before macOS deadlocks.
#
# Runs as a sibling to scripts/demo.sh. Polls vm_stat + sysctl every
# WATCHDOG_INTERVAL seconds, logs to .demo/logs/watchdog.log, and triggers
# scripts/demo.sh stop + SIGKILL fallbacks if any of:
#   - free RAM (free + speculative pages) drops below FREE_KILL_GB
#   - macOS swap usage exceeds SWAP_KILL_GB
#   - compressor occupancy exceeds COMP_KILL_GB
#
# "Available memory" on macOS is free + speculative + inactive (inactive
# pages are LRU cache the kernel reclaims instantly). free alone reads low
# even on a healthy system — don't gate on free.
#
# Defaults for a 64 GB host:
#   AVAIL_KILL_GB=6   — kernel starts to thrash below ~6 GB true-available
#   SWAP_KILL_GB=4    — once swap is in use, allocation rate is the bottleneck
#   COMP_KILL_GB=12   — compressor that big means kernel is squeezing hard
#
# The watchdog itself is one bash loop + a few small subprocesses per tick;
# its own footprint is well under 50 MB so it won't be the OOM trigger.
#
# Stop manually: kill $(cat .demo/pids/watchdog.pid)
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$ROOT/.demo/logs"
PID_DIR="$ROOT/.demo/pids"
LOG="$LOG_DIR/watchdog.log"
mkdir -p "$LOG_DIR" "$PID_DIR"

INTERVAL="${WATCHDOG_INTERVAL:-3}"
AVAIL_KILL_GB="${AVAIL_KILL_GB:-6}"
SWAP_KILL_GB="${SWAP_KILL_GB:-4}"
COMP_KILL_GB="${COMP_KILL_GB:-12}"
AVAIL_WARN_GB="${AVAIL_WARN_GB:-12}"
COMP_WARN_GB="${COMP_WARN_GB:-4}"

# vm_stat reports its own page size in the header (`page size of N bytes`).
# This can differ from `sysctl hw.pagesize` — the latter returns 4096 on
# some hosts even when vm_stat reports values in 16K pages — so trust the
# header. Falls back to 16384 (Apple Silicon default) if parsing fails.
PAGE_SIZE="$(vm_stat | awk '/page size of/ { for (i=1;i<=NF;i++) if ($i=="of") { print $(i+1); exit } }')"
PAGE_SIZE="${PAGE_SIZE:-16384}"

bytes_to_gb() {
  awk -v b="$1" 'BEGIN { printf "%.2f", b / 1073741824 }'
}

pages_to_gb() {
  awk -v p="$1" -v s="$PAGE_SIZE" 'BEGIN { printf "%.2f", (p * s) / 1073741824 }'
}

# vm_stat lines look like:  "Pages free:    809980."
# Strip the trailing period and grab the last numeric column.
vmstat_value() {
  local key="$1"
  vm_stat | awk -v k="$key" '
    $0 ~ k ":" { gsub(/[.,]/, "", $NF); print $NF; exit }
  '
}

swap_used_gb() {
  # vm.swapusage: total = 1024.00M used = 12.34M free = 1011.66M (encrypted)
  sysctl -n vm.swapusage 2>/dev/null | awk '
    {
      for (i = 1; i <= NF; i++) {
        if ($i == "used") {
          v = $(i+2); gsub(/M/, "", v);
          printf "%.2f", v / 1024;
          exit
        }
      }
      print "0.00"
    }
  '
}

read_pid() {
  cat "$PID_DIR/$1.pid" 2>/dev/null | tr -d ' \n' || true
}

rss_mb() {
  local pid="${1:-}"
  [ -z "$pid" ] && { echo "-"; return; }
  local kb
  kb="$(ps -o rss= -p "$pid" 2>/dev/null | tr -d ' ')"
  [ -z "$kb" ] && { echo "-"; return; }
  awk -v k="$kb" 'BEGIN { printf "%.0f", k / 1024 }'
}

trip_kill() {
  local reason="$1"
  local ts
  ts="$(date +%H:%M:%S)"
  echo "[$ts] WATCHDOG KILL: $reason" >> "$LOG"
  echo "[$ts] WATCHDOG KILL: $reason" >&2

  # Graceful first.
  "$ROOT/scripts/demo.sh" stop >> "$LOG" 2>&1 || true
  sleep 2

  # Force any survivors. Order matters — kill JVMs first since they're
  # the heaviest, then node services.
  pkill -9 -f "com.daml.http.Main" 2>/dev/null || true
  pkill -9 -f "daml start"          2>/dev/null || true
  pkill -9 -f "canton"              2>/dev/null || true
  pkill -9 -f "next dev"            2>/dev/null || true
  pkill -9 -f "/oracle/(src|dist)/index" 2>/dev/null || true
  pkill -9 -f "/auth/(src|dist)/index"   2>/dev/null || true

  for svc in canton oracle app auth; do
    local p
    p="$(read_pid "$svc")"
    [ -n "$p" ] && kill -9 "$p" 2>/dev/null || true
  done

  echo "[$ts] WATCHDOG done — demo killed; system protected" >> "$LOG"
  echo "[$ts] WATCHDOG done — demo killed; system protected" >&2
  exit 1
}

# Record our own pid so the user can stop us cleanly.
echo "$$" > "$PID_DIR/watchdog.pid"

ts="$(date +%H:%M:%S)"
echo "[$ts] watchdog start: interval=${INTERVAL}s kill thresholds avail<${AVAIL_KILL_GB}GB swap>${SWAP_KILL_GB}GB comp>${COMP_KILL_GB}GB" >> "$LOG"

# Trap so we clean our pid file on exit.
trap 'rm -f "$PID_DIR/watchdog.pid"' EXIT

while true; do
  free_p=$(vmstat_value 'Pages free' || echo 0)
  spec_p=$(vmstat_value 'Pages speculative' || echo 0)
  inact_p=$(vmstat_value 'Pages inactive' || echo 0)
  comp_p=$(vmstat_value 'Pages occupied by compressor' || echo 0)
  avail_gb=$(pages_to_gb "$((${free_p:-0} + ${spec_p:-0} + ${inact_p:-0}))")
  comp_gb=$(pages_to_gb "${comp_p:-0}")
  swap_gb=$(swap_used_gb)

  canton_pid="$(read_pid canton)"
  oracle_pid="$(read_pid oracle)"
  app_pid="$(read_pid app)"
  canton_mb="$(rss_mb "$canton_pid")"
  oracle_mb="$(rss_mb "$oracle_pid")"
  app_mb="$(rss_mb "$app_pid")"

  ts="$(date +%H:%M:%S)"
  level="OK"
  if awk -v v="$avail_gb" -v t="$AVAIL_WARN_GB" 'BEGIN { exit !(v < t) }'; then level="WARN"; fi
  if awk -v v="$comp_gb"  -v t="$COMP_WARN_GB"  'BEGIN { exit !(v > t) }'; then level="WARN"; fi
  printf '[%s] %-4s avail=%sGB swap=%sGB comp=%sGB canton=%sMB oracle=%sMB app=%sMB\n' \
    "$ts" "$level" "$avail_gb" "$swap_gb" "$comp_gb" "$canton_mb" "$oracle_mb" "$app_mb" >> "$LOG"

  if awk -v v="$avail_gb" -v t="$AVAIL_KILL_GB" 'BEGIN { exit !(v < t) }'; then
    trip_kill "available RAM ${avail_gb}GB < ${AVAIL_KILL_GB}GB threshold"
  fi
  if awk -v v="$swap_gb" -v t="$SWAP_KILL_GB" 'BEGIN { exit !(v > t) }'; then
    trip_kill "swap usage ${swap_gb}GB > ${SWAP_KILL_GB}GB threshold"
  fi
  if awk -v v="$comp_gb" -v t="$COMP_KILL_GB" 'BEGIN { exit !(v > t) }'; then
    trip_kill "compressor ${comp_gb}GB > ${COMP_KILL_GB}GB threshold"
  fi

  sleep "$INTERVAL"
done
