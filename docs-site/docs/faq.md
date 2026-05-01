---
title: FAQ
sidebar_position: 6
---

# FAQ

Procurement-grade answers. Short, honest, no marketing voice. Pulled from real questions across the buying committee.

## Adoption and status

### Is IRSForge production-ready?

It is a reference implementation. IRS, OIS, and basis are wired end-to-end and tested. CDS templates and lifecycle are real; the pricing inputs run off a flat scalar stub by default (real credit feeds plug through the same `OracleProvider` seam used by SOFR). Cross-currency (fixed/float) ships end-to-end including multi-currency CSA mark publishing through the per-(ccy, indexId) curve book. ASSET-family lifecycle is gated until a price oracle is wired up. Rates desks running real flow should expect to harden the oracle and integrate their own KYC / AML / booking pipeline.

### Are there live deployments today?

Not yet. IRSForge is in pre-production reference shape. Integrators are evaluating; testnet bring-up is a parallel work track. The honest gap list for testnet / mainnet integration is in [Deploying to Production](./operations/deploying-production).

### What's the roadmap?

SWPM/MARS parity Phases 0 to 6 are complete. Phases 7 / 8 / 9 (advanced risk, XVA, non-linear products) are out of scope for this release. Tracked work at [github.com/sneg55/irsforge/issues](https://github.com/sneg55/irsforge/issues).

## License and support

### What's the license?

AGPL v3.0. Use it, fork it, modify it. If you run it as a service to third parties, ship modifications back.

### Is there commercial support?

Not packaged today. The codebase is OSS and self-supportable: full Daml tests, full TypeScript tests, CI lint enforcement, monitoring hooks, documented runbooks. Commercial support is something an integrator can offer; IRSForge does not bundle it.

### Who do we call when it breaks?

In the OSS posture: GitHub issues, your own engineering team. The codebase is small enough (three build boundaries, one YAML) that a competent Canton-aware engineering team can own it. If your firm requires vendor SLA, that needs a commercial integrator relationship outside of IRSForge itself.

## Cost of adoption

### How much engineering effort to deploy?

In rough sizing:

- **Demo bring-up**: `make demo` after `make setup`. Minutes.
- **Local production-shape (real OIDC, JWKS, no live curves)**: 1 person-day to flip the YAML, configure the IdP client, and verify the JWKS path.
- **Real oracle adapter** (single vendor, single index): on the order of 200 to 400 LOC across one Daml template + one TS adapter + one YAML provider id. The NY Fed SOFR provider in-tree is the reference shape.
- **Multi-participant Canton network bring-up**: depends on participant infrastructure already in place. The IRSForge-side YAML is small; the Canton-side participant / synchronizer / DAR-vetting work is the bulk.

### How much does it cost to run?

- IRSForge components: one Node.js process for `auth/`, one for `oracle/`, one for the Next.js frontend. Modest CPU and memory.
- Canton participant cost is whatever your participant stack costs you anyway.
- No per-trade fees, no message-bus fees, no vendor licenses on the IRSForge side. Data-vendor licenses (SOFR, Markit, FX feeds) are per your vendor relationship.

## Integration

### Can I plug in my own OIDC provider?

Yes. `auth.provider: oidc` points at your IdP for user authentication. `auth.builtin` stays alongside it to mint Canton ledger JWTs (the layering is required because Canton speaks RS256 JWKS, not arbitrary IdP tokens). Schema-enforced. See [BYO Auth](./integrators/byo-auth).

### Can I plug in my own oracle or data provider?

Yes, three steps and zero forks:

1. Implement the on-ledger `Oracle.Interface.Provider` in a new Daml template (mirror `NYFedProvider.daml`).
2. Add a TS class implementing `OracleProvider` and call `registerProvider` in `bootstrap-registrations.ts`.
3. Reference the provider id in `irsforge.yaml`.

The stub provider and the NY Fed SOFR provider both ship through this same seam. See [BYO Oracle](./integrators/byo-oracle).

### How do I add a currency or rate index?

One YAML edit (`currencies:` or `rateFamilies:` in `irsforge.yaml`), then `make generate-daml-config`. No Daml or TypeScript changes needed. ESTR / SONIA were added this way in April 2026.

### Can I run multi-participant instead of the single-sandbox demo?

Yes. `topology: network` swaps the single-sandbox topology for a multi-participant Canton deployment with per-participant party hosting. Same DAR. See [BYO Topology](./integrators/byo-topology) and [Deploying to Production](./operations/deploying-production).

### What's required from my Canton participant?

A standard participant node, the IRSForge DAR uploaded and vetted, and `irsforge.yaml` configured with your Canton party identifiers. The participant's JSON API needs to validate JWTs against the IRSForge auth service's JWKS (`--auth=rs-256-jwks=<authPublicUrl>/.well-known/jwks.json`).

## Data and privacy

### How does the regulator-observer model work?

Every swap-related contract includes the configured `regulators: [Party]` as observers at creation. The regulator sees full lifecycle, marks, settlement, and disputes on-ledger. Counterparties don't see each other's positions. Sub-transaction privacy is enforced by Canton, not by IRSForge.

### Can I run multiple regulators across jurisdictions?

Yes. The schema allows ≥ 1 regulator org and `regulators: [Party]` threads through every relevant template. Each regulator party becomes an observer on the contracts it is configured for.

### Where does my market data live?

On the ledger as `Observation` / `Curve` / `CurveSnapshot` contracts, signed by the configured oracle provider party. Subscribers configured under the provider see the data; everyone else does not. You bring the data license; IRSForge does not redistribute licensed feeds.

### Where does my data physically reside?

Wherever your Canton participant is deployed. IRSForge is not a hosted SaaS; the ledger and the application both run on your infrastructure (or your platform operator's, in the network topology).

## Security

### Is settlement really atomic?

Atomic per leg, not across legs. `TriggerLifecycle` (rate effects) and `Settle` (cash) are separate transactions, by design. This is also how ISDA describes IRS settlement. IRSForge does not claim cross-leg atomicity.

### How are credentials handled?

Service-account secrets live as bcrypt hashes in `auth/service-accounts.yaml` (gitignored), with raw secrets in environment variables on the oracle host. Tokens are short-lived (15 min default) and refreshed at 80% TTL. Detailed posture in [Security & Trust](./security-and-trust) and [Service Accounts](./operations/service-accounts).

### What if a key is compromised?

Per-key recovery procedures in [Security & Trust](./security-and-trust#recovery-posture). Short version: service-account secrets rotate via auth + oracle restart. RS256 keys rotate via multi-key JWKS. IdP secrets rotate per your IdP procedure.

### Can I use an HSM for the RS256 key?

Operationally compatible. Not packaged in-tree. Replace the file-system key load in `auth/` with your HSM client.

## Compliance

### Does IRSForge produce DTCC GTR / EMIR / MiFID / SFTR reports?

Not natively. Regulator-as-observer gives you the underlying data on-ledger; the wire-format and reporting cadence is integrator scope. Most compliance teams already have a reporting pipeline; pointing it at the ledger is the integration step.

### Does IRSForge handle KYC / AML / sanctions?

No. These belong upstream of the proposal. IRSForge assumes counterparties and operators have already passed onboarding by the time their party is provisioned.

### Are FpML imports / exports legally equivalent to the originals?

The schema round-trip is faithful for the FpML-expressible families (IRS, OIS, basis, XCCY). The `Accept` choice on the resulting Daml contract is the binding execution. Whether the FpML XML retrieved from the ledger constitutes a confirmation of record under your firm's policy is a question for your legal team, not IRSForge.

### How does this satisfy ISDA conventions?

Day-count, roll, schedule, business-day adjustment, and floating-index compounding are consumed from Daml Finance's `V3.Types.Date` modules as ISDA-shaped. Holiday calendars are informational only on a 24/7 ledger (continuous settlement does not pause for holidays). See [Compliance & Audit](./compliance-and-audit#continuous-247-settlement-vs-isda-conventions).

## UX

### Does the workspace work on a phone?

Not for serious use. The blotter, leg composer, and CSA ladder are dense desktop UIs designed for ≥ 1440px screens, mirroring Bloomberg / Reuters terminals. Mobile renders, but trade entry and the action panel assume desktop. A read-only mobile blotter view is roadmap.

### Browser support?

Modern Chrome / Safari / Firefox. The frontend uses standard React 19 + Next.js 16; no IE-era compatibility shims.

### Accessibility?

Tailwind + shadcn/ui primitives ship with reasonable a11y defaults. There is no formal WCAG audit; that's integrator scope if your procurement requires it.

## Product

### Why hedge on Canton at all?

If your positions are not on Canton, you don't. IRSForge serves desks that already have on-chain exposure (tokenized treasuries, repo books, private credit on Canton) and want to hedge that exposure with an instrument that settles on the same ledger. Hedging an on-chain position with an off-chain instrument introduces settlement risk between the two legs.

### Can I see CDS or XCCY end-to-end before integrating?

IRS and OIS are end-to-end in the demo. CDS books, prices, and lifecycles against a flat scalar stub (default 2% probability, 40% recovery); a real credit feed plugs through the same `OracleProvider` seam used by SOFR. Cross-currency books, prices, and marks against the multi-currency curve book + on-ledger `FxSpot`. The ledger model and lifecycle are real for all three families.

### What about swaptions, caps, floors, CMS?

Not modeled. SWPM covers these; IRSForge ships linear rates + CDS only. Out of scope for this release.

## See also

- [Risk & Controls](./risk-and-controls)
- [Compliance & Audit](./compliance-and-audit)
- [Security & Trust](./security-and-trust)
- [Comparison](./comparison)
- [BYO Integrators](./integrators/overview)
