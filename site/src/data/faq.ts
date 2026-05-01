export interface FaqEntry {
  q: string
  a: string
}

export const faq: FaqEntry[] = [
  {
    q: 'Is IRSForge production-ready?',
    a: "It's a reference implementation. IRS/OIS/basis are wired end-to-end and tested. CDS templates and lifecycle are real; the pricing inputs run off a flat scalar stub (real credit feeds plug through the same OracleProvider seam used by SOFR). Cross-currency (fixed/float) ships end-to-end including multi-currency CSA mark publishing through the per-(ccy,indexId) curve book; vendor-price validation depth is integrator scope. ASSET-family lifecycle is gated until a price oracle is wired up. Rates desks running real flow should expect to harden the oracle and integrate their own KYC/AML/booking pipeline.",
  },
  {
    q: 'How do I add a currency or rate index?',
    a: 'One YAML edit (`currencies:` or `rateFamilies:` in irsforge.yaml), then `make generate-daml-config`. No Daml or TypeScript changes needed.',
  },
  {
    q: 'Can I plug in my own OIDC provider?',
    a: 'Yes. `auth.provider: oidc` points at your IdP for user authentication; `auth.builtin` stays alongside it to mint Canton ledger JWTs (the layering is required because Canton speaks RS256 JWKS, not arbitrary IdP tokens). Schema-enforced. See the BYO Auth recipe in docs.',
  },
  {
    q: 'Can I plug in my own oracle or data provider?',
    a: 'Yes — three steps and zero forks. (1) Implement the on-ledger `Oracle.Interface.Provider` in a new Daml template (mirror `NYFedProvider.daml`). (2) Add a TS class implementing `OracleProvider` and call `registerProvider` in `bootstrap-registrations.ts`. (3) Reference the provider id in `irsforge.yaml`. The stub provider and the NY Fed SOFR provider both ship through this same seam — see BYO Oracle recipe.',
  },
  {
    q: 'Can I run multi-participant instead of the single-sandbox demo?',
    a: 'Yes. `topology: network` in irsforge.yaml swaps the single-sandbox topology for a multi-participant Canton deployment with per-participant party hosting. Documented in `docs-site/docs/operations/deploying-production.md`. The demo profile and the production profile run the same DAR.',
  },
  {
    q: 'How does the regulator-observer model work?',
    a: "Every swap-related contract includes the regulator party as observer. The regulator sees full lifecycle and cashflows on-ledger; counterparties don't see each other's positions. Sub-transaction privacy is enforced by Canton, not by IRSForge.",
  },
  {
    q: "What's required from my Canton participant?",
    a: "A standard participant node, the IRSForge DAR uploaded, and irsforge.yaml configured with your Canton party identifiers. That's it.",
  },
  {
    q: 'Is settlement really atomic?',
    a: "Atomic *per leg*, not across legs. TriggerLifecycle (rate effects) and Settle (cash) are separate transactions by design. Same as how ISDA describes IRS settlement. We don't claim what we don't deliver.",
  },
  {
    q: 'Can I see CDS or CCY end-to-end before integrating?',
    a: 'IRS and OIS are end-to-end in the demo. CDS books, prices, and lifecycles against a flat scalar stub (2% default probability, 40% recovery); a real credit feed plugs through the same OracleProvider seam used by SOFR. Cross-currency (fixed/float) books, prices, and marks against the multi-currency CurveBook + on-ledger FxSpot. The ledger model and lifecycle are real for all three families.',
  },
  {
    q: 'Does the workspace work on a phone?',
    a: 'Not for serious use. The blotter, leg composer, and CSA ladder are dense desktop UIs designed for ≥1440px screens, like the Bloomberg/Reuters terminals they mirror. Mobile renders, but trade entry and the action panel assume desktop. A read-only mobile blotter view is on the roadmap.',
  },
  {
    q: "What's the licensing?",
    a: 'AGPL v3.0. Use it, fork it, modify it. Ship modifications back if you run it as a service.',
  },
]
