#!/usr/bin/env bash
# deploy/hetzner-up.sh — idempotent Hetzner Cloud provisioning for the
# shared IRSForge demo. Creates a firewall (22/80/443) and a server with
# cloud-init that pre-installs Docker, then prints the public IP.
#
# Prereqs:
#   - hcloud CLI configured (`hcloud context list` shows an active context)
#   - SSH key uploaded to Hetzner (`hcloud ssh-key list`)
#
# Defaults pick CPX31 in nbg1 (4 AMD vCPU, 8 GB, 160 GB, x86, EU latency).
# Override via env vars if you want a different size/location:
#
#   HCLOUD_TYPE=ccx23 HCLOUD_LOCATION=ash deploy/hetzner-up.sh
#
# Daml 2.10 SDK is x86-only — do NOT pick a CAX (ARM) type or the
# container build will fail on the daml install step. The script
# refuses arm types up front.

set -euo pipefail

NAME="${1:-irsforge-demo}"
# CPX32 supersedes CPX31 (same specs: 4 AMD vCPU / 8 GB / 160 GB);
# Hetzner stopped accepting CPX31 orders in nbg1/fsn1/hel1 around
# 2026-Q1 in favor of the -32 line. CPX31 stays valid for HCLOUD_TYPE
# overrides where the location still allows it (e.g. ash, hil, sin).
TYPE="${HCLOUD_TYPE:-cpx32}"
LOCATION="${HCLOUD_LOCATION:-nbg1}"
IMAGE="${HCLOUD_IMAGE:-ubuntu-24.04}"
SSH_KEY="${HCLOUD_SSH_KEY:-irsforge-demo}"
FIREWALL_NAME="${NAME}-fw"

if [[ "$TYPE" == cax* ]]; then
  echo "ERROR: $TYPE is ARM; Daml 2.10 SDK ships x86 binaries only." >&2
  echo "       Pick CPX, CX, or CCX (x86) — see deploy/README.md." >&2
  exit 1
fi

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing: $1" >&2; exit 1; }
}
require_cmd hcloud

if ! hcloud context active >/dev/null 2>&1; then
  echo "ERROR: no active hcloud context. Run 'hcloud context create <name>'." >&2
  exit 1
fi

# Sanity-check the SSH key exists. cloud-init can't recover if the user
# typoed a key name — better to fail before billing starts.
if ! hcloud ssh-key describe "$SSH_KEY" >/dev/null 2>&1; then
  echo "ERROR: SSH key '$SSH_KEY' not found in Hetzner." >&2
  echo "       Available: $(hcloud ssh-key list -o columns=name | tail -n +2 | tr '\n' ' ')" >&2
  exit 1
fi

# ---- firewall (idempotent) -----------------------------------------------
# Rules: inbound 22 (SSH), 80 (HTTP), 443 (HTTPS), each on IPv4 + IPv6.
# Outbound is unrestricted by default.
firewall_rules_json() {
  cat <<'JSON'
[
  { "direction": "in", "protocol": "tcp", "port": "22",
    "source_ips": ["0.0.0.0/0", "::/0"], "description": "SSH" },
  { "direction": "in", "protocol": "tcp", "port": "80",
    "source_ips": ["0.0.0.0/0", "::/0"], "description": "HTTP (Caddy ACME challenge + redirect)" },
  { "direction": "in", "protocol": "tcp", "port": "443",
    "source_ips": ["0.0.0.0/0", "::/0"], "description": "HTTPS (Caddy → Next.js prod)" }
]
JSON
}

if hcloud firewall describe "$FIREWALL_NAME" >/dev/null 2>&1; then
  echo "firewall '$FIREWALL_NAME' already exists, skipping create"
else
  echo "creating firewall '$FIREWALL_NAME'"
  rules_file="$(mktemp)"
  trap 'rm -f "$rules_file"' EXIT
  firewall_rules_json > "$rules_file"
  hcloud firewall create --name "$FIREWALL_NAME" --rules-file "$rules_file" >/dev/null
fi

# ---- cloud-init user-data ------------------------------------------------
# Installs Docker + compose plugin + git on first boot. No app deploy here —
# we want the demo image to be a separate `ssh + git pull + docker compose up`
# step so iteration on the image doesn't require re-provisioning.
userdata_file="$(mktemp)"
cat > "$userdata_file" <<'USERDATA'
#cloud-config
package_update: true
package_upgrade: false

packages:
  - ca-certificates
  - curl
  - git
  - ufw
  - htop

runcmd:
  - [ sh, -c, "curl -fsSL https://get.docker.com | sh" ]
  - [ systemctl, enable, --now, docker ]
  - [ mkdir, -p, /opt/irsforge ]

write_files:
  - path: /etc/motd
    content: |
      IRSForge shared-demo VPS.
      Repo lands at /opt/irsforge; bring up with:
        cd /opt/irsforge && docker compose -f deploy/docker-compose.yml up -d --build
USERDATA

# ---- server (idempotent) -------------------------------------------------
if hcloud server describe "$NAME" >/dev/null 2>&1; then
  echo "server '$NAME' already exists; current IP:"
  hcloud server ip "$NAME"
  rm -f "$userdata_file"
  exit 0
fi

echo "creating server '$NAME' ($TYPE, $IMAGE, $LOCATION) — this takes ~30s"
hcloud server create \
  --name "$NAME" \
  --type "$TYPE" \
  --image "$IMAGE" \
  --location "$LOCATION" \
  --ssh-key "$SSH_KEY" \
  --firewall "$FIREWALL_NAME" \
  --user-data-from-file "$userdata_file"
rm -f "$userdata_file"

ip="$(hcloud server ip "$NAME")"
echo
echo "----------------------------------------------------------------"
echo "  server provisioned"
echo "  name:     $NAME"
echo "  type:     $TYPE  ($LOCATION)"
echo "  ipv4:     $ip"
echo "  ssh:      ssh root@$ip"
echo
echo "  next:"
echo "    1. wait ~60s for cloud-init to finish (docker install)"
echo "    2. ssh root@$ip"
echo "    3. cd /opt/irsforge && git clone <your-repo> ."
echo "    4. flip platform.demoReset.enabled to true in irsforge.yaml"
echo "    5. docker compose -f deploy/docker-compose.yml up -d --build"
echo "    6. point demo.irsforge.com A record at $ip + install Caddy"
echo "----------------------------------------------------------------"
