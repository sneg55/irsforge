---
id: service-accounts
title: Service Accounts (Machine Identities)
sidebar_position: 3
---

# Service Accounts

The oracle runs two long-lived services that need ledger JWTs without a human in the loop:

| Service | `actAs` | Notes |
|---|---|---|
| `mark-publisher` | `[Operator]` | Publishes mark-to-market observations on a cron |
| `scheduler`      | `[Scheduler]` | Fires `*ByScheduler` choices (trigger / settle-net / mature) |

In demo profile these tokens are HS256-minted against Canton's `--unsafe-jwt-token` mode. In `builtin` and `oidc` profiles they are minted via **OAuth2 client-credentials** (RFC 6749 §4.4) against the project's `auth/` service. Demo deployments and production deployments share the same oracle binary; only configuration changes.

## Three resolution paths

The oracle's `resolveServiceToken(accountId, config)` (in `oracle/src/authz/service-token.ts`) dispatches on three branches, first match wins:

1. **Env override** — if `SERVICE_TOKEN_<ID>` is set (e.g. `SERVICE_TOKEN_SCHEDULER`), it is used verbatim. `OPERATOR_TOKEN` is the legacy alias for `SERVICE_TOKEN_MARK_PUBLISHER`. For bring-your-own-JWT setups that already have token infrastructure.
2. **Demo branch** — when `auth.provider === 'demo'`, falls through to the existing HS256 bootstrap (`/v1/parties` → qualified-party mint).
3. **Service-account branch** — when `auth.provider` ∈ `{builtin, oidc}`, POSTs `grant_type=client_credentials` to `${platform.authPublicUrl}/auth/oauth/token`. A refresh timer re-fetches the token at 80% of `expires_in`.

## Non-demo setup

### 1. Declare accounts in `irsforge.yaml`

```yaml
auth:
  provider: builtin
  builtin:
    issuer: "https://auth.example.com"
    keyAlgorithm: RS256
    tokenTtlSeconds: 900
    refreshTtlSeconds: 86400
  serviceAccounts:
    - id: scheduler
      actAs: ["Scheduler::..."]
      readAs: ["PartyA::...", "PartyB::...", "Operator::...", "Regulator::..."]
    - id: mark-publisher
      actAs: ["Operator::..."]
      readAs: ["PartyA::...", "PartyB::...", "Regulator::..."]
```

The `shared-config` schema enforces this at load time:

- `mark-publisher` is **mandatory** when `auth.provider !== 'demo'`.
- `scheduler` is mandatory **additionally** when `scheduler.enabled: true`.

A deployment that forgets either will fail at boot with a clear pointer to `auth.serviceAccounts[id=...]`.

Use exact Canton party identifiers in `actAs` and `readAs`. The auth service copies these arrays directly into the ledger JWT; it does not resolve hints for service accounts.

### 2. Create `auth/service-accounts.yaml`

Copy `auth/service-accounts.example.yaml`. Generate bcrypt hashes for each account:

```bash
node -e 'require("bcrypt").hash(process.argv[1], 10).then(console.log)' "my-scheduler-secret"
```

Populate:

```yaml
accounts:
  - id: scheduler
    clientSecretHash: "$2b$10$..."
  - id: mark-publisher
    clientSecretHash: "$2b$10$..."
```

Both the `accounts[].id` in this file and the `auth.serviceAccounts[].id` in `irsforge.yaml` must agree. The auth service cross-validates at startup and refuses to boot on a mismatch.

The real `auth/service-accounts.yaml` is gitignored — never commit it.

### 3. Pass raw secrets to the oracle

```bash
export SERVICE_CLIENT_SECRET_SCHEDULER="my-scheduler-secret"
export SERVICE_CLIENT_SECRET_MARK_PUBLISHER="my-mark-secret"
```

The env-var key is `SERVICE_CLIENT_SECRET_<UPPERCASE_ID_WITH_HYPHEN_AS_UNDERSCORE>`.

### 4. Boot

`auth/` must be running before the oracle starts — the oracle POSTs to `/auth/oauth/token` at startup, fails loud on unreachable or `invalid_client`. Expected log events on clean boot:

```
service_token_acquired  accountId=mark-publisher
service_token_acquired  accountId=scheduler
scheduler_service_started
```

The refresh timer re-POSTs at `expires_in × 0.8` and swaps the token in place. Each refresh logs `service_token_refreshed`. A transient refresh failure schedules one retry at `expires_in × 0.9` total before giving up; a persistent refresh failure causes subsequent `getToken()` calls to reject, which the scheduler tick catches and retries on the next cron fire.

## Swapping in Okta / Keycloak / Auth0

The OAuth2 client-credentials endpoint `/auth/oauth/token` in `auth/src/routes/oauth-token.ts` implements the standard shape. To use an external IdP instead:

1. Register `scheduler` and `mark-publisher` as client-credentials apps in your IdP.
2. Configure the IdP to embed the Canton `https://daml.com/ledger-api` claim with the correct `actAs`/`readAs` parties (via custom claim mapping).
3. Point the oracle at your IdP's token endpoint: the resolver reads `${platform.authPublicUrl}/auth/oauth/token`, so either override `platform.authPublicUrl` or use the `SERVICE_TOKEN_*` env escape hatch with a token your IdP issues directly.

Only use this participant-JWKS shape for the external-IdP-token alternative above. In the default IRSForge service-account path, participants trust the IRSForge auth service JWKS and the oracle calls IRSForge's `/auth/oauth/token`.

## Rotation

1. Generate a new secret and bcrypt hash.
2. Update `auth/service-accounts.yaml` on the auth host.
3. Update `SERVICE_CLIENT_SECRET_*` on the oracle host.
4. Restart the auth service (picks up new hash).
5. Restart the oracle (picks up new secret; acquires a fresh JWT).

In-flight tokens remain valid until they expire (default 15 minutes). No revocation endpoint ships — short TTLs are the intentional design choice.

## Troubleshooting

| Event | Meaning | Remediation |
|---|---|---|
| `service_token_env_override` | env var shortcircuit used | expected when `SERVICE_TOKEN_*` or `OPERATOR_TOKEN` is set |
| `service_token_acquire_failed` with `invalid_client` | wrong secret or unknown id | re-check registry file + env var |
| `service_token_acquire_failed` network error | auth service unreachable | check `platform.authPublicUrl` + auth liveness |
| `service_token_refresh_failed` | transient refresh problem | auto-retries once; if persists, restart |

## Design rationale

See `docs/superpowers/specs/2026-04-23-scheduler-token-portability-design.md` for the full rationale — why OAuth2 client-credentials over signed JWT assertion, why service-account metadata and secrets live in separate files, and why `OPERATOR_TOKEN` is preserved as a legacy alias.
