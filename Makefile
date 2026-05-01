.PHONY: setup build test test-auth test-coverage dev demo stop restart status logs clean gen-package-ids generate-daml-config lint-hardcodes shared-config-build shared-pricing-build canton-party-directory-build docs docs-build ci

# Resolve to an absolute path so sub-make `cd contracts && $(DAML)` keeps working.
DAML := $(abspath scripts/daml-quiet.sh)

# Build shared-config dist so `loadConfig` sees current zod schemas.
# Ran unconditionally before dev/build — skipping this was the root cause
# of the Phase 3 Stage B smoke bug (schema had curves/floatingRateIndices,
# dist did not, `loadConfig` silently returned empty arrays).
shared-config-build:
	@cd shared-config && npm run build --silent

# Build shared-pricing dist so oracle/app's tsc can resolve
# @irsforge/shared-pricing types (package.json points at dist/index.js).
# Workspaces hoist correctly but tsc still needs the compiled output.
# Skipping this on a clean checkout (e.g. fresh container build) was the
# root cause of "Cannot find module @irsforge/shared-pricing" during the
# 2026-04-30 Hetzner deploy.
shared-pricing-build:
	@cd shared-pricing && npm run build --silent

# Build canton-party-directory dist (tsup) so app's subpath imports
# (`canton-party-directory/react`, `/ui`) resolve. Same root cause as
# shared-pricing-build: package.json `exports` map points at dist/, which
# doesn't exist on a clean checkout.
canton-party-directory-build:
	@cd packages/canton-party-directory && npm run build --silent

# Regenerate Setup/GeneratedConfig.daml from the resolved config.
# Runs before any `daml build` so contracts/ always sees fresh currency
# / CDS-reference-name literals. See shared-config/scripts/generate-daml-config.ts.
generate-daml-config: shared-config-build
	@cd shared-config && npm run generate:daml --silent
	@cd shared-config && npm run generate:fixture --silent 2>/dev/null || true

# Install all dependencies
setup:
	@echo "Installing Daml SDK..."
	@which daml || (curl -sSL https://get.daml.com/ | sh)
	@echo "Downloading Daml Finance bundle..."
	@cd contracts && mkdir -p lib && \
		curl -sSL https://github.com/digital-asset/daml-finance/releases/download/sdk%2F2.10.0/daml-finance-bundle-sdk-2.10.0.tar.gz | \
		tar xz -C lib
	@echo "Installing shared config dependencies..."
	@cd shared-config && npm install
	@echo "Regenerating Daml config from YAML..."
	@$(MAKE) generate-daml-config
	@echo "Installing auth dependencies..."
	@cd auth && npm install
	@echo "Installing oracle dependencies..."
	@cd oracle && npm install
	@echo "Installing frontend dependencies..."
	@cd app && npm install
	@echo "Installing marketing site dependencies..."
	@cd site && npm install

# Regenerate package-id TS constants (one per declared DAR)
gen-package-ids:
	@./scripts/gen-package-ids.sh

# Build all
build: shared-config-build shared-pricing-build canton-party-directory-build
	@$(MAKE) generate-daml-config
	@cd contracts && $(DAML) build
	@$(MAKE) gen-package-ids
	@cd auth && npm run build
	@cd oracle && npm run build
	@cd app && npm run build

# Run Daml contract tests
test:
	@cd contracts && $(DAML) test

# Run auth + config tests
test-auth:
	@cd shared-config && npm test
	@cd auth && npm test

# Run shared-pricing vitest suite (Phase 4 Stage A — pricing engine + strategies)
.PHONY: test-pricing
test-pricing:
	@cd shared-pricing && npm test

# Full test pyramid with coverage thresholds. Each vitest workspace fails the
# run if its coverage.thresholds (configured in vitest.config.ts) regresses.
# Run before merging substantial branches; this is the local-only equivalent
# of a CI gate. Daml side is exercised by `make test`; node:test workspaces
# (shared-config, auth) lack a thresholds primitive so they just run normally.
test-coverage: shared-config-build
	@cd shared-config && npm test
	@cd auth && npm test
	@cd shared-pricing && npm run test:coverage
	@cd oracle && npm run test:coverage
	@cd app && npm run test:coverage
	@cd contracts && $(DAML) test

# Sandbox-gated scheduler E2E — proves the seeded past-maturity IRS
# retires without clicks. Requires a running `make demo` (Canton + oracle
# up). Safe to run multiple times: asserts at-least-one MaturedSwap, not
# exactly-one, so re-runs against a live sandbox still pass.
.PHONY: test-scheduler-e2e
test-scheduler-e2e:
	@cd oracle && IRSFORGE_SANDBOX_RUNNING=1 npx vitest run src/services/scheduler/__tests__/e2e-sandbox.test.ts

# Phase 0 Step 5 — fail the build if Phase-0 hardcodes creep back into source.
# See scripts/lint-hardcodes.sh for the exact guards.
lint-hardcodes:
	@./scripts/lint-hardcodes.sh

# Start development environment
dev: shared-config-build
	@$(MAKE) generate-daml-config
	@cd contracts && $(DAML) build
	@$(MAKE) gen-package-ids
	@AUTH_PROVIDER=$$(grep 'provider:' irsforge.yaml | head -1 | awk '{print $$2}'); \
	echo "Auth mode: $$AUTH_PROVIDER"; \
	if [ "$$AUTH_PROVIDER" = "demo" ]; then \
		echo "Starting Canton sandbox + JSON API..."; \
		cd contracts && $(DAML) start & \
	else \
		echo "Starting auth service..."; \
		cd auth && npm run dev & \
		sleep 2; \
		echo "Starting Canton sandbox + JSON API (JWKS auth)..."; \
		cd contracts && $(DAML) start \
			--json-api-option=--auth=rs-256-jwks=http://localhost:3002/.well-known/jwks.json & \
	fi; \
	sleep 10; \
	echo "Starting oracle service..."; \
	cd oracle && npm run dev & \
	echo "Starting frontend..."; \
	cd app && npm run dev

# Demo lifecycle — thin shims over scripts/demo.sh, the canonical
# orchestrator. demo.sh handles port preflight, init-script ExitSuccess
# gate, the .demo/seeded marker, and uses a "Demo seed complete" log-grep
# as the success signal (daml SDK 2.10 frequently exits non-zero after a
# clean shutdown even when the script itself succeeded). Keeping a single
# orchestrator means downstream Canton participants who fork this repo
# inherit one canonical control plane, not two competing ones.
#
# `make dev` (above) stays as the foreground, no-auto-seed iteration path.
demo:
	@./scripts/demo.sh start

stop:
	@./scripts/demo.sh stop

restart:
	@./scripts/demo.sh restart

status:
	@./scripts/demo.sh status

# Tail logs for one service. Usage: make logs SVC=canton
logs:
	@./scripts/demo.sh logs $(SVC)

# Docusaurus dev server (live preview at http://localhost:3030)
docs:
	@cd docs-site && npm install --silent && npm start -- --port 3030

# Build the docs site (CI gate — fails on broken links)
docs-build:
	@cd docs-site && npm install --silent && npm run build

# Deploy the docs site to Cloudflare Pages (project: irsforge-docs)
docs-deploy: docs-build
	@cd docs-site && npx wrangler pages deploy build --project-name=irsforge-docs --branch=main --commit-dirty=true

# Stop everything and clean. Routes through scripts/demo.sh stop first so
# the .demo/seeded marker and per-service pid files are cleared the same
# way as a normal stop; the pkill fallback only catches orphans the
# orchestrator missed.
clean:
	@./scripts/demo.sh stop 2>/dev/null || true
	@pkill -f "daml start" || true
	@pkill -f "oracle" || true
	@pkill -f "irsforge-auth" || true
	@pkill -f "next" || true
	@cd contracts && rm -rf .daml
	@rm -rf app/src/shared/ledger/generated
	@cd shared-config && rm -rf dist node_modules
	@cd auth && rm -rf dist node_modules keys
	@cd oracle && rm -rf dist node_modules
	@cd app && rm -rf .next node_modules

# Marketing site (Astro) — independent build boundary
.PHONY: site site-build site-preview site-test site-qa site-deploy

site:
	@cd site && npm run dev

site-build:
	@cd site && npm run build

site-preview: site-build
	@cd site && npm run preview

site-test:
	@cd site && npx playwright test

site-qa:
	@cd site && npm run qa

site-deploy: site-build
	@cd site && npx wrangler pages deploy dist --project-name=irsforge-site --branch=main --commit-dirty=true

# Hackathon decks — recompose HTML fragments and regenerate the PDFs.
# Uses Playwright/Chromium (already a site/ devDependency).
.PHONY: decks decks-html decks-pdf

decks-html:
	@docs/hackathon/build-decks.sh

decks-pdf: decks-html
	@cd site && npm install --silent --no-audit --no-fund >/dev/null 2>&1 || true
	@cd site && npx playwright install --with-deps chromium >/dev/null 2>&1 || true
	@node docs/hackathon/build-pdfs.mjs

decks: decks-pdf

# Host-agnostic CI gate — Tier 2 #6 from docs/reference-impl-roadmap.md.
# Wrap this in any pipeline runner (GitHub Actions, GitLab CI, Jenkins,
# Buildkite, Drone, CircleCI) with `run: make ci`. Host-specific workflow
# YAML stays out of the reference per the BYO-integrator filter.
#
# Composition (fail-fast, in order):
#   1. lint-hardcodes              — Phase 0 hardcode scanner
#   2. verify-eslint-plugins       — pre-flight that lint plugins loaded
#   3. build                       — full build chain (dist + Daml + JS)
#   4. test-coverage               — full pyramid with ratcheted thresholds
#   5. docs-build                  — Docusaurus build, broken-link checker
#
# Excluded by design: test-scheduler-e2e (sandbox-gated), site-* (marketing),
# decks (manual). See docs/superpowers/specs/2026-04-29-make-ci-standalone-gate-design.md.
ci: lint-hardcodes
	@./scripts/verify-eslint-plugins.sh
	@$(MAKE) build
	@$(MAKE) test-coverage
	@$(MAKE) docs-build
	@echo "make ci passed"
