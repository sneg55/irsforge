import type {
  CsaPayload,
  CsaState,
  DamlMap,
  GoverningLaw,
  MarkToMarketPayload,
} from '@/shared/ledger/types'

export interface CsaViewModel {
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
  /** ContractId of the open Csa.Dispute:DisputeRecord when state is
   *  MarkDisputed or Escalated; null otherwise. Lets the drawer fetch
   *  the disputer / counterMark / reason / notes for display + counter
   *  actions without re-querying the whole CSA. */
  activeDispute: string | null
  isdaMasterAgreementRef: string
  governingLaw: GoverningLaw
  imAmount: number
}

function decodeMap<K extends string, V>(m: DamlMap<K, V>): Map<K, V> {
  if (!Array.isArray(m)) {
    throw new Error('Daml Map arrived as Record (Canton v1 quirk) — type as DamlMap<K,V>')
  }
  return new Map(m)
}

export function decodeCsa(contractId: string, p: CsaPayload): CsaViewModel {
  const thr = decodeMap(p.threshold)
  const dirA = thr.get('DirA')
  const dirB = thr.get('DirB')
  if (dirA === undefined || dirB === undefined) {
    throw new Error(`Csa ${contractId}: threshold missing DirA/DirB`)
  }
  // Derive the UI-facing `postedByA` / `postedByB` split from the signed
  // on-chain `csb`. Positive csb ⇒ A pledged (postedByA = csb, postedByB = 0);
  // negative csb ⇒ B pledged. This keeps all UI call sites that speak the
  // "per-side posted" vocabulary working while the ledger enforces the
  // real "only one side pledged at a time" invariant.
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
    thresholdDirA: parseFloat(dirA),
    thresholdDirB: parseFloat(dirB),
    mta: parseFloat(p.mta),
    rounding: parseFloat(p.rounding),
    valuationCcy: p.valuationCcy,
    postedByA,
    postedByB,
    state: p.state,
    lastMarkCid: p.lastMarkCid,
    activeDispute: p.activeDispute,
    isdaMasterAgreementRef: p.isdaMasterAgreementRef,
    governingLaw: p.governingLaw,
    imAmount: parseFloat(p.imAmount),
  }
}

export interface MarkViewModel {
  contractId: string
  csaCid: string
  partyA: string
  partyB: string
  asOf: string
  exposure: number
  snapshot: string
}

export function decodeMark(contractId: string, p: MarkToMarketPayload): MarkViewModel {
  return {
    contractId,
    csaCid: p.csaCid,
    partyA: p.partyA,
    partyB: p.partyB,
    asOf: p.asOf,
    exposure: parseFloat(p.exposure),
    snapshot: p.snapshot,
  }
}

// Marks carry a stringified `csaCid` back-reference to the CSA contract that
// existed at PublishMark time — but every PublishMark/SettleVm archives and
// re-creates the CSA, so that text goes stale. The `(partyA, partyB)` pair
// is the stable identity of the CSA across its contract-id lineage, so the
// frontend filters marks by pair, not by csaCid.
export function pairKey(partyA: string, partyB: string): string {
  return `${partyA}|${partyB}`
}
