export interface Persona {
  audience: string
  headline: string
  body: string
  next: { href: string; label: string }
}

export const personas: Persona[] = [
  {
    audience: 'Heads of Trading',
    headline: 'Hedge T+0 against your T+0 repo book.',
    body: 'Your desk runs SWPM and MARS. IRSForge mirrors that workflow piece for piece, with the same leg composer, the same risk view, the same blotter. The change is the rail: coupons settle on Canton, weekends and all, on the same ledger your repo already lives on.',
    next: { href: '#parity', label: 'See the workspace' },
  },
  {
    audience: 'Heads of Risk',
    headline: 'Counterparty and settlement risk on one ledger.',
    body: 'Every CSA pair is a signed contract on the ledger. Variation margin, threshold, and minimum transfer amount are observable, not implied. Settlement risk against off-chain hedges goes away because the hedge no longer leaves the chain. The regulator is wired in as observer, not as a quarterly report.',
    next: { href: '#tour', label: 'See the audit trail' },
  },
  {
    audience: 'Heads of Operations',
    headline: 'One ledger to reconcile, not two.',
    body: 'Trade economics, lifecycle events, cashflows, and collateral movements live on the same ledger. End-of-day reconciliation across two infrastructures collapses to one. Confirms are a contract state, not an email thread.',
    next: { href: '#tour', label: 'See the lifecycle' },
  },
  {
    audience: 'CTOs and Engineering Leads',
    headline: 'Fork the reference implementation.',
    body: 'AGPL on GitHub. Configure irsforge.yaml, point at your participant, deploy. No fork, no integration project, no committee. Built on Daml Finance interfaces as shipped, not reimplemented. Every extension point is a YAML edit plus a small adapter.',
    next: { href: '#deploy', label: 'See the deploy steps' },
  },
  {
    audience: 'Compliance',
    headline: 'Regulator as observer, by construction.',
    body: "Every swap-related contract lists the regulator as observer at creation. Read access is a Canton primitive, not a separate audit pipeline. Counterparties never see across each other's books, and the regulator sees everything. Sub-transaction privacy is Canton’s, not ours.",
    next: { href: '#tour', label: 'See the regulator view' },
  },
]
