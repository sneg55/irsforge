# IRSForge shared-demo image — single container running the full stack.
#
# Targets linux/amd64 (Hetzner CX/CPX). The Daml 2.10 SDK distribution
# ships x86_64 binaries; if you target arm64 (Hetzner CAX) you'll need to
# pin a Daml release with aarch64 support and adjust the install step.
#
# Build:    docker build -f deploy/Dockerfile -t irsforge-demo:latest .
# Run:      docker compose -f deploy/docker-compose.yml up -d
# Reset:    handled by the in-container loop in deploy/entrypoint.sh
#
# The image bakes `make build` (DARs, dist/, .next/) so container start is
# fast — `scripts/demo.sh start` skips its build_prereqs in deploy mode.

FROM eclipse-temurin:17-jdk-noble

ARG NODE_VERSION=20
# Daml SDK version MUST match contracts/daml.yaml `sdk-version`. If they
# drift, `make build` compiles the DAR with one SDK and `daml start` at
# runtime rebuilds it with another — different package-id hash, every
# Canton query 400s with "unknown template ID", oracle crashes on
# seedIndices().
ARG DAML_SDK_VERSION=2.10.4
# Daml Finance bundle release coordinate — independent of the SDK version
# above. Bundles tag against the SDK version they were built FOR, not
# against the latest SDK. As of 2026-04 the latest published bundle is
# under tag `sdk/2.10.0`, even though Daml SDK 2.10.4 has shipped. Mirrors
# the version pinned in `make setup`.
ARG DAML_FINANCE_BUNDLE_VERSION=2.10.0

# System deps + Node 20. NodeSource publishes amd64 and arm64; if the
# Daml SDK below resolves we're already on amd64 anyway.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl ca-certificates git gnupg jq make procps lsof tini \
 && curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

# Daml SDK install — the official installer drops binaries into
# $HOME/.daml/bin and expects to be on PATH. We install as root so the
# entrypoint sees the SDK regardless of UID. NOTE: do NOT set DAML_HOME
# manually — daml-helper interprets it as the SDK install root and
# constructs invalid paths like `$DAML_HOME/bin/bin/daml`. Trust the
# installer's default resolution and just put bin on PATH.
ENV PATH="/root/.daml/bin:${PATH}"
RUN curl -sSL https://get.daml.com/ | sh -s "${DAML_SDK_VERSION}"

WORKDIR /app

# Workspace-aware install. Root package.json declares `workspaces` so
# `npm install` at root sets up the cross-package symlinks (auth/oracle/
# app reference @irsforge/shared-pricing + irsforge-shared-config — those
# resolve via workspace links, NOT via npmjs.org). Per-package
# `cd shared-config && npm install` does NOT work for downstream packages
# because npm tries to fetch the workspace deps from the registry.
#
# Manifests for every workspace must be present before the install — copy
# them all up-front so the dep layer caches across source changes. site/
# is a workspace too but only used for the marketing landing; we skip its
# install via explicit --workspace flags below.
COPY package.json package-lock.json* ./
COPY shared-config/package.json shared-config/
COPY shared-pricing/package.json shared-pricing/
COPY auth/package.json   auth/
COPY oracle/package.json oracle/
COPY app/package.json    app/
COPY site/package.json   site/
COPY packages/canton-party-directory/package.json packages/canton-party-directory/

# HUSKY=0 — fresh installs in non-tty environments fail husky's prepare
# script (memory: feedback_husky_in_worktree).
ENV HUSKY=0
# npm bug #4828: a lockfile generated on macOS-arm64 records only the
# darwin-arm64 platform binaries for optional deps (rollup, lightningcss,
# tailwind-oxide). Re-running `npm install` against that lockfile on
# linux-x64 leaves the linux platform binaries unresolved and crashes
# at build time with "Cannot find module @rollup/rollup-linux-x64-gnu".
# Regenerate the lockfile in-container to force per-platform resolution.
RUN rm -f package-lock.json && npm install --no-audit --no-fund \
      --include-workspace-root \
      --workspace=shared-config \
      --workspace=shared-pricing \
      --workspace=auth \
      --workspace=oracle \
      --workspace=app \
      --workspace=canton-party-directory

# Copy the rest of the repo and build everything. `make build` runs the
# full chain: shared-config dist, generate-daml-config, daml build,
# gen-package-ids, auth/oracle/app builds.
COPY . .

# Daml Finance bundle — same step `make setup` does locally. Note this
# uses DAML_FINANCE_BUNDLE_VERSION (decoupled from DAML_SDK_VERSION above).
RUN cd contracts && mkdir -p lib && \
    curl -sSL "https://github.com/digital-asset/daml-finance/releases/download/sdk%2F${DAML_FINANCE_BUNDLE_VERSION}/daml-finance-bundle-sdk-${DAML_FINANCE_BUNDLE_VERSION}.tar.gz" \
    | tar xz -C lib

RUN make build

# Defaults consumed by scripts/demo.sh and deploy/entrypoint.sh.
ENV IRSFORGE_DEPLOY_MODE=prod
ENV IRSFORGE_RESET_INTERVAL_MINUTES=60

EXPOSE 3000 3001 3002 6865 7575

# tini reaps the demo.sh background processes cleanly on container stop.
ENTRYPOINT ["/usr/bin/tini", "--", "/app/deploy/entrypoint.sh"]
