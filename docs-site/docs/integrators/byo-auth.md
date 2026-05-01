---
title: BYO Auth
sidebar_label: BYO Auth
sidebar_position: 2
---

# Bring Your Own Auth Provider

IRSForge's auth surface is a thin layer between **your IdP** (the source of user identity) and **Canton** (which validates ledger JWTs against a JWKS). The `auth/` service is the bridge.

## What changes

- `irsforge.yaml` only — flip `auth.provider` from `demo` / `builtin` to `oidc` and fill in `auth.oidc`.
- `auth.builtin` stays alongside it. `auth.builtin` still mints the **ledger JWT** Canton validates; `auth.oidc` is what your users authenticate against.
- Participant config: each Canton participant validates IRSForge-minted ledger JWTs against the IRSForge auth service JWKS at `auth.builtin.issuer/.well-known/jwks.json`.

## YAML

```yaml
auth:
  provider: oidc
  builtin:
    issuer: "https://auth.your-org.example/irsforge"
    keyAlgorithm: RS256
    tokenTtlSeconds: 900
    refreshTtlSeconds: 86400
  oidc:
    authority: "https://login.your-idp.example"
    clientId: irsforge
    clientSecret: "..."   # injected via env in production
    scopes: [openid, profile, email]
```

`shared-config/src/schema.ts` enforces that `auth.builtin` is present whenever `auth.provider != demo` — Canton speaks RS256 JWKS, not arbitrary IdP tokens, so the bridge is required.

## Why two layers

Canton participants need a JWKS endpoint to validate JWTs. Most IdPs publish theirs, but the JWT **claims** Canton expects (`actAs`, `readAs`, party set) are IRSForge-specific and won't appear in raw IdP tokens. The auth service mints the ledger JWT *after* the IdP authenticates the user, mapping the IdP identity to the configured `orgs[].party`.

## What you don't need to change

- Daml contracts, oracle, frontend code: untouched.
- DAR upload: same DAR.
- Canton topology config: only the JWKS URL and audience.

## Multi-tenant guard

The current single-auth-service-per-deployment assumption requires that each authenticated user maps to **one** party (their org's). If you expose a shared auth service across orgs, add an IdP claim/group check before minting ledger JWTs so users can only request their own org's party.

## See also

- [Parties & Auth](../concepts/parties-and-auth) — the full conceptual model
- [`reference/config-yaml#auth`](../reference/config-yaml) — every key documented
- [Deploying Production](../operations/deploying-production) — end-to-end deployment
