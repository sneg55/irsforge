# IRSForge — Shared Demo Deployment

Reference recipe for hosting the demo on a single VPS where multiple users
share one Canton sandbox. Designed for hackathon / showcase usage, NOT for
real ledger persistence — the in-memory sandbox is wiped on every reset.

## What you get

- All four services (Canton sandbox, auth, oracle, Next.js app) running in
  one container, prod builds, behind a single reverse proxy.
- Round-clock automatic reset (default: every hour at :00 UTC) so judges
  poking at the demo always land on a known clean baseline.
- A countdown banner at the top of the SPA telling users when the next
  reset will fire and what gets wiped.

## Sizing — Hetzner reference

Image targets `linux/amd64`; the Daml 2.10 SDK distribution ships x86_64
binaries. ARM (Hetzner CAX) needs a Daml release with aarch64 support and
a `--platform=linux/arm64` build, both out of scope for this default
recipe.

| Plan | vCPU | RAM | Verdict |
|---|---|---|---|
| CX22 | 2 | 4 GB | Skip — Canton JVM eats half, no headroom |
| **CX32 / CPX31** | **4** | **8 GB** | **Recommended** for a hackathon demo |
| CX42 / CPX41 | 8 | 16 GB | Comfortable; use if you also rebuild on-box |

## VPS bring-up

```bash
# 1. SSH in, install Docker.
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out + back in for the group change

# 2. Clone the repo.
git clone https://github.com/<your-fork>/irsforge.git
cd irsforge

# 3. Edit irsforge.yaml — flip platform.demoReset.enabled to true so the
#    SPA banner appears.
#
#    platform:
#      demoReset:
#        enabled: true
#        intervalMinutes: 60

# 4. Build + start (takes ~10 min on first build — Daml SDK + node deps + builds).
docker compose -f deploy/docker-compose.yml up -d --build

# 5. Watch the boot log.
docker compose -f deploy/docker-compose.yml logs -f
```

The container is healthy when the Next.js prod server answers on port
3000. The compose file binds it to `127.0.0.1:3000` so external traffic
must land via your reverse proxy.

## Caddy reverse proxy + TLS

Install Caddy on the host (NOT in the container — keeping TLS on the host
means cert renewal survives container rebuilds):

```bash
sudo apt install -y caddy
sudo tee /etc/caddy/Caddyfile <<'EOF'
demo.irsforge.example {
    reverse_proxy 127.0.0.1:3000
    encode gzip
}
EOF
sudo systemctl reload caddy
```

Caddy fetches a Let's Encrypt cert on first request and auto-renews. Point
the public DNS A record at the VPS, hit the URL, you're done.

## How resets work

- The container's `deploy/entrypoint.sh` boots the demo via
  `scripts/demo.sh start` (prod mode), then enters a foreground loop that
  sleeps until the next round-clock boundary and runs
  `scripts/reset-demo.sh`.
- `reset-demo.sh` calls `scripts/demo.sh restart` — full
  Canton + auth + oracle + app cycle. Downtime per reset: ~30–60s.
- The cadence is driven by `IRSFORGE_RESET_INTERVAL_MINUTES` (env, default
  60) and MUST match `platform.demoReset.intervalMinutes` in
  `irsforge.yaml`. The entrypoint warns at boot if they disagree.

### Adjusting the cadence

Edit two places in lockstep:

1. `irsforge.yaml`:
   ```yaml
   platform:
     demoReset:
       intervalMinutes: 30
   ```
2. `deploy/docker-compose.yml`:
   ```yaml
   environment:
     IRSFORGE_RESET_INTERVAL_MINUTES: "30"
   ```

Then `docker compose up -d --build`.

### Disabling the in-container loop

Set `IRSFORGE_RESET_INTERVAL_MINUTES=0` is NOT supported — the entrypoint
exits on values < 60s. To replace the loop with host cron instead:

1. Comment out the reset-loop block at the bottom of
   `deploy/entrypoint.sh`, replacing with `tail -f /dev/null`.
2. Add a host crontab entry:
   ```cron
   0 * * * * docker exec irsforge-demo bash /app/scripts/reset-demo.sh \
              >> /var/log/irsforge-reset.log 2>&1
   ```

## Operational commands

```bash
# Tail one service's log inside the container
docker exec irsforge-demo bash scripts/demo.sh logs canton

# Force a manual reset (matches what the loop does on cadence)
docker exec irsforge-demo bash scripts/reset-demo.sh

# Full container restart (rebuilds nothing, just reboots services)
docker compose -f deploy/docker-compose.yml restart

# Rebuild after a code change
docker compose -f deploy/docker-compose.yml up -d --build
```

## What's NOT in scope here

- **Ledger persistence.** The Canton sandbox runs in-memory; any reset
  wipes everything. Adding Postgres-backed Canton is a separate config
  change in `contracts/daml.yaml` and not part of the shared-demo recipe.
- **Multi-participant topology.** This image runs one sandbox; the
  reference impl supports multi-participant network mode but that needs
  a different orchestration (one container per participant + canton
  domain coordinator).
- **Per-user isolation.** Every visitor talks to the same ledger; their
  actions are visible to each other within a reset window. The banner
  countdown is the coordination signal; idle-skip / per-session forks are
  not implemented.
