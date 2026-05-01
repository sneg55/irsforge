import type { CsaPayload, CsaState, DamlMap, GoverningLaw } from '../../shared/types.js'

export interface DecodedCsa {
  contractId: string
  operator: string
  partyA: string
  partyB: string
  regulators: string[]
  thresholdDirA: number
  thresholdDirB: number
  mta: number
  rounding: number
  valuationCcy: string
  postedByA: Map<string, number>
  postedByB: Map<string, number>
  state: CsaState
  lastMarkCid: string | null
  isdaMasterAgreementRef: string
  governingLaw: GoverningLaw
  imAmount: number
}

export function decodeDamlMap<K extends string, V>(m: DamlMap<K, V>): Map<K, V> {
  return new Map(m)
}

// Canton's JSON API v1 serialises `Map k v` as `[[k,v], ...]`. If the
// publisher ever receives a Record-shaped threshold (it shouldn't, but a
// server-side schema change could flip the wire format) we must fail
// loudly — silently parseFloat'ing a missing field would quietly write
// zero-valued threshold/rounding and corrupt every downstream gateCall.
// (`feedback_canton_json_api_v1_maps.md`, `feedback_no_defensive_fallbacks.md`.)
export function decodeCsa(contractId: string, p: CsaPayload): DecodedCsa {
  if (!Array.isArray(p.threshold)) {
    throw new Error(`Csa ${contractId}: threshold not in array form`)
  }
  const thr = decodeDamlMap(p.threshold)
  const thrA = thr.get('DirA')
  const thrB = thr.get('DirB')
  if (thrA === undefined || thrB === undefined) {
    throw new Error(`Csa ${contractId}: threshold missing DirA/DirB`)
  }
  if (!Array.isArray(p.csb)) {
    throw new Error(`Csa ${contractId}: csb not in array form`)
  }
  // Signed `csb` → UI-facing `postedByA` / `postedByB` split. Positive csb
  // means A pledged; negative means B pledged. Kept in the decoder so
  // downstream oracle code (publisher, summary) doesn't re-implement the
  // sign logic.
  const postedByA = new Map<string, number>()
  const postedByB = new Map<string, number>()
  for (const [ccy, signed] of p.csb) {
    const n = parseFloat(signed)
    if (n > 0) postedByA.set(ccy, n)
    else if (n < 0) postedByB.set(ccy, -n)
    else {
      postedByA.set(ccy, 0)
      postedByB.set(ccy, 0)
    }
  }
  return {
    contractId,
    operator: p.operator,
    partyA: p.partyA,
    partyB: p.partyB,
    regulators: p.regulators,
    thresholdDirA: parseFloat(thrA),
    thresholdDirB: parseFloat(thrB),
    mta: parseFloat(p.mta),
    rounding: parseFloat(p.rounding),
    valuationCcy: p.valuationCcy,
    postedByA,
    postedByB,
    state: p.state,
    lastMarkCid: p.lastMarkCid,
    isdaMasterAgreementRef: p.isdaMasterAgreementRef,
    governingLaw: p.governingLaw,
    imAmount: parseFloat(p.imAmount),
  }
}
