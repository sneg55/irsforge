---
title: Deploying to Production
---

# Deploying to Production

A checklist for participants moving from `make demo` to a real Canton deployment.

> **Scope.** This page covers the **IRSForge application configuration** for a production-shape deployment: profile, auth, providers, scheduler, CSA onboarding, service accounts. The Canton-network-side work (participant nodes, synchronizer/domain wiring, DAR upload + vetting, party allocation, JWKS plumbing, bootstrap sequencing) lives at [Canton Network runbook](./canton-network-runbook). Use this checklist for the application config, then complete the runbook before treating testnet/mainnet integration as live.

## 1. Configure the topology

```yaml
profile: production
topology: network
routing: subdomain    # or path
```

For each org you'll host, add an `orgs[]` entry pointing at that org's participant URL.

## 2. Switch auth to OIDC

```yaml
platform:
  authPublicUrl: "https://auth.example.com"       # IRSForge auth service origin — the SPA calls /auth/* here
  frontendUrl:   "https://app.example.com"

auth:
  provider: oidc
  # builtin is still required under oidc — the auth service uses these to
  # mint the ledger JWT after the IdP verifies identity.
  builtin:
    issuer:           "https://auth.example.com"  # JWT `iss` claim; Canton validates this against the JWKS
    keyAlgorithm:     RS256
    tokenTtlSeconds:  900
    refreshTtlSeconds: 86400
  oidc:
    authority:    "https://login.example.com"    # external OpenID Provider (Azure AD / Google / Okta / …)
    clientId:     irsforge
    clientSecret: "…"                             # never the SPA — only the server-side auth service sees this
    scopes:       [openid, profile, email]
```

Three URLs, three roles — do not conflate them:

- `platform.authPublicUrl` — HTTP origin of the IRSForge auth service. The SPA calls `/auth/authorize`, `/auth/handoff`, `/auth/refresh`, `/auth/logout` here.
- `auth.builtin.issuer` — the `iss` claim stamped on ledger JWTs. Canton participants validate those signatures against the JWKS served by the IRSForge auth service, normally `${platform.authPublicUrl}/.well-known/jwks.json`.
- `auth.oidc.authority` — the external OpenID Provider. Only the auth service talks to it (authorization-code flow). The SPA never calls the IdP directly.

Configure your IdP client and callback URL, then point each Canton participant at the IRSForge auth service's JWKS so it trusts those minted tokens (not the IdP's raw JWTs): `--auth=rs-256-jwks=<authPublicUrl>/.well-known/jwks.json`.

Current implementation note: the auth service verifies the IdP `id_token`, then maps the requested `/org/<orgId>` to `orgs[].party`. Before exposing one auth service across multiple unrelated orgs, add or enable an IdP claim/group check so users can only request their own org.

## 3. Wire real curve providers

```yaml
curves:
  currencies:
    USD:
      discount:   { provider: nyfed }
      projection: { indexId: USD-SOFR, provider: nyfed }
```

Remove the corresponding `demo.stubCurves` entries. If your provider isn't yet implemented, add it under `oracle/src/providers/<name>/` and register it in the schema (see [Providers](../oracle/providers)).

## 4. Realistic scheduler cadence

```yaml
scheduler:
  enabled: true
  manualOverridesEnabled: false   # critical — hides demo manual buttons
  cron:
    trigger:   "0 */1 * * * *"    # every minute
    settleNet: "0 */5 * * * *"
    mature:    "0 0 */1 * * *"
```

## 5. Remove the entire `demo:` block

Schema rejects `demo:` when `profile: production`. Make sure none of your demo-only stubs have leaked.

## 6. CSA onboarding

The current init flow seeds CSAs at boot via `submitMulti [partyA, partyB, operator]` — convenient for a reference sandbox. For live multi-tenant onboarding use the **`CsaProposal`** template (`Csa.Proposal:CsaProposal`), which mirrors the `CdsProposal` pattern: proposer + operator are signatories, counterparty + configured regulators are observers, and three choices cover the bilateral lifecycle — `Accept`, `Reject`, and `Withdraw`. See [CSA Model](../concepts/csa-model#production-hardening) and the [Operator view](../ui/operator) for the onboarding console.

## 7. Migration considerations

- Existing CSAs keep their on-chain parameters. Threshold / MTA changes to yaml apply only to **new** CSAs.
- Regenerate `Setup/GeneratedConfig.daml` (`make generate-daml-config`) and re-build contracts before re-running init.
- Re-generate `template-ids.ts` (`make gen-package-ids`) on every DAR rebuild — the file is gitignored.

## 8. Operational identities

- Declare `mark-publisher` and, when `scheduler.enabled: true`, `scheduler` in `auth.serviceAccounts`.
- Use exact Canton party identifiers in each service account's `actAs` and `readAs` arrays; the auth service does not resolve hints there.
- Store the matching client secrets in a secrets manager and expose them to the oracle as `SERVICE_CLIENT_SECRET_MARK_PUBLISHER` and `SERVICE_CLIENT_SECRET_SCHEDULER`.
- The oracle obtains short-lived ledger JWTs from `/auth/oauth/token`; avoid long-lived static JWTs unless you are using the documented `SERVICE_TOKEN_*` escape hatch.

## 9. Pre-flight checks

```bash
make build              # full clean build
make test               # Daml tests pass
make test-auth          # config validation passes for production profile
make test-pricing       # pricing engine still green
```

## 10. Canton Network bring-up

The Canton-network side (participant nodes, synchronizer, DAR upload + vetting, party allocation, JWKS wiring, bootstrap sequencing) is documented separately at [Canton Network runbook](./canton-network-runbook). Complete that runbook in addition to this checklist before treating testnet/mainnet integration as live.
