#!/usr/bin/env bash
# scripts/demo-lib-listener.sh — port-to-listener-pid resolution.
# Sourced by demo-lib.sh; no standalone execution.
#
# Carved out of demo-lib.sh to keep that file under the 300-line cap.
# These two functions are a single-purpose Linux helper: given a TCP
# port, return the pid of the process holding it as LISTEN. Used by
# launch_service to replace the transient nohup-bash wrapper pid (which
# exits in milliseconds) with the real long-lived listener pid.

# Resolve the long-lived listener pid for a service by port, replacing the
# transient bash-wrapper pid that launch_service initially records. The
# `nohup bash -c "$cmd"` wrapper exits as soon as it execs npm/next/node,
# so the recorded $! pid is dead within milliseconds — stop_service then
# falls through to the brittle svc_pattern pkill fallback. Looking the pid
# up by the port it eventually binds is the only reliable signal.
#
# Canton is exempt: `daml start` runs under a daml-helper wrapper whose
# pid stays alive for the lifetime of the JVM and which forwards SIGTERM
# correctly, so the wrapper pid is the right thing to track there.
resolve_listener_pid_by_port() {
  local name="$1" port="$2" timeout="${3:-60}"
  if ! wait_tcp localhost "$port" "$timeout"; then
    return 1
  fi
  local pid
  pid="$(lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -1)"
  if [ -z "$pid" ]; then
    # lsof v4.95 (Ubuntu Noble) misses next-server's listener on port 3000
    # under containerd in some namespace configurations even though the
    # socket is plainly visible in /proc/net/tcp6. Fall back to reading
    # /proc directly: find the inode for the listening port, then walk
    # /proc/<pid>/fd/* for the holder of that socket.
    pid="$(_resolve_listener_pid_via_proc "$port" 2>/dev/null || echo "")"
  fi
  [ -n "$pid" ] && echo "$pid"
}

_resolve_listener_pid_via_proc() {
  local port="$1"
  local hex_port inode
  printf -v hex_port '%04X' "$port"
  # /proc/net/tcp{,6} columns: sl, local_addr:port, rem_addr:port, state,
  # tx_q rx_q, tr tm_when, retrnsmt, uid, timeout, inode. State 0A = LISTEN.
  inode="$(awk -v p=":$hex_port" '$2 ~ p"$" && $4 == "0A" {print $10; exit}' \
           /proc/net/tcp /proc/net/tcp6 2>/dev/null)"
  [ -z "$inode" ] && return 1
  local pid_dir fd target
  for pid_dir in /proc/[0-9]*; do
    [ -d "$pid_dir/fd" ] || continue
    for fd in "$pid_dir"/fd/*; do
      [ -L "$fd" ] || continue
      target="$(readlink "$fd" 2>/dev/null || echo "")"
      if [ "$target" = "socket:[$inode]" ]; then
        basename "$pid_dir"
        return 0
      fi
    done
  done
  return 1
}
