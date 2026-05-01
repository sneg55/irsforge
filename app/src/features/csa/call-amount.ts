import type { CsaViewModel } from './decode'

// TS mirror of `Csa.Csa:computeRequired` / `targetCsb` / `gateCall`.
// Sign convention matches on-chain: `exposure > 0` ⇒ A owes B.
//
// `side` names the party that has to fund the open call (post collateral
// or have collateral called from them). When the gated amount is zero —
// either below MTA, or because current CSB already meets target — the
// helper returns `null`, which the UI surfaces as "—".

export interface CallSignal {
  side: 'A' | 'B'
  amount: number
}

export function computeCallSignal(csa: CsaViewModel, exposure: number): CallSignal | null {
  const fromA = Math.max(0, exposure - csa.thresholdDirB)
  const fromB = Math.max(0, -exposure - csa.thresholdDirA)
  const target = fromA - fromB
  const postedA = csa.postedByA.get(csa.valuationCcy) ?? 0
  const postedB = csa.postedByB.get(csa.valuationCcy) ?? 0
  const current = postedA - postedB
  const gated = gateCall(target - current, csa.mta, csa.rounding)
  if (gated === 0) return null
  return { side: gated > 0 ? 'A' : 'B', amount: Math.abs(gated) }
}

function gateCall(raw: number, mta: number, rounding: number): number {
  if (Math.abs(raw) < mta) return 0
  if (rounding === 0) return raw
  return Math.round(raw / rounding) * rounding
}
