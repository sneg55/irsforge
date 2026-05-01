export type Maturity = 'reference' | 'demo-stub' | 'partial'

export interface Product {
  title: string
  body: string
  meta: string
  maturity: Maturity
  maturityNote: string
}

export const products: Product[] = [
  {
    title: 'Interest Rate Swaps',
    body: 'Fixed-float, OIS, and basis swaps on the Daml Finance V0 swap instrument. NY Fed SOFR fetcher ships in the box; ESTR, SONIA, and any other index plug in through one oracle seam, no Daml or TypeScript edits.',
    meta: 'SOFR, ESTR, SONIA. Act/360. 24/7 settlement.',
    maturity: 'reference',
    maturityNote: 'Wired end-to-end. Tested.',
  },
  {
    title: 'Credit Default Swaps',
    body: 'Single-name CDS on the same lifecycle: ISDA-shaped premium and contingent legs, quarterly Act/360, payout = (1 − recovery) × notional, proposal-accept flow, regulator projection. The demo seeds credit as a flat scalar; a real feed plugs in through the same provider seam SOFR uses.',
    meta: 'Quarterly Act/360. Single-name. Pluggable credit feed.',
    maturity: 'reference',
    maturityNote: 'Lifecycle and contracts are real. Credit feed is demo-seeded.',
  },
  {
    title: 'Cross-Currency Swaps',
    body: 'Fixed-float XCCY with notional exchange (initial and final) plus per-leg coupons in each leg’s own currency, on the same Daml Finance lifecycle and CSA infrastructure as IRS. USD/EUR ships in the demo with onchain FxSpot for reporting-currency translation; new pairs are a YAML edit.',
    meta: 'Fixed-float. Notional exchange. Onchain FxSpot.',
    maturity: 'reference',
    maturityNote:
      'Shape and pricing wired end-to-end. Vendor-price validation is integrator scope.',
  },
]
