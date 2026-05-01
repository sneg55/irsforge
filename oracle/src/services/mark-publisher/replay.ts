// Phase 5 Stage D — replay adapters.
//
// Single source of truth for "given on-chain state, what does shared-pricing
// say the mark should be?". Used by:
//   1. The live publisher (src/index.ts wires these into MarkPublisherService.computeDeps).
//   2. The reproducibility replay harness (replay.test.ts).
//
// Both must traverse on-chain state identically, otherwise the harness
// stops being a check on the publisher and becomes a duplicate
// implementation that masks bugs in either path.

import type { CurveBook, DiscountCurve, PricingContext, SwapConfig } from '@irsforge/shared-pricing'
import type { LedgerClient } from '../../shared/ledger-client.js'
import {
  CURVE_TEMPLATE_ID,
  DAML_FINANCE_OBSERVATION_TEMPLATE_ID,
  FLOATING_RATE_INDEX_TEMPLATE_ID,
  FX_SPOT_TEMPLATE_ID,
  SWAP_WORKFLOW_TEMPLATE_ID,
} from '../../shared/template-ids.js'
import type { SwapWorkflow } from '../../shared/types.js'
import { flattenObservations, toDiscountCurve, toFloatingRateIndex } from './replay-decode.js'
import { resolveCds } from './replay-decode-cds.js'
import { resolveBasis, resolveFpml, resolveXccy } from './replay-decode-fpml.js'
import { IRS_INSTRUMENT_TEMPLATE_ID, resolveIrsLike } from './replay-decode-irs.js'
import type { CurvePayload, IndexPayload, ObservationPayload, SnapshotKey } from './replay-types.js'

export type { SnapshotKey } from './replay-types.js'
// Re-export for callers that previously imported the constant from replay.ts.
export { IRS_INSTRUMENT_TEMPLATE_ID }

/**
 * Build a `PricingContext` from a snapshot. Always errors loudly when a
 * snapshot reference is no longer on chain — never defaults to a stale
 * curve or empty observations (`feedback_no_defensive_fallbacks.md`),
 * because a silent default makes the publisher and the replay harness
 * compute different marks without any error surface.
 */
export async function buildContextFromSnapshot(
  client: LedgerClient,
  snapshot: SnapshotKey,
  valuationCcy: string,
): Promise<PricingContext> {
  const allCurves = (await client.query(CURVE_TEMPLATE_ID)) as Array<{
    contractId: string
    payload: CurvePayload
  }>
  const allIndices = (await client.query(FLOATING_RATE_INDEX_TEMPLATE_ID)) as Array<{
    contractId: string
    payload: IndexPayload
  }>
  const allObs = (await client.query(DAML_FINANCE_OBSERVATION_TEMPLATE_ID)) as Array<{
    contractId: string
    payload: ObservationPayload
  }>

  const curvesById = new Map(allCurves.map((c) => [c.contractId, c.payload]))
  const indicesById = new Map(allIndices.map((i) => [i.contractId, i.payload]))

  for (const cid of snapshot.curveCids) {
    if (!curvesById.has(cid)) {
      throw new Error(`buildContextFromSnapshot: curve ${cid} missing from ledger`)
    }
  }
  for (const cid of snapshot.indexCids) {
    if (!indicesById.has(cid)) {
      throw new Error(`buildContextFromSnapshot: index ${cid} missing from ledger`)
    }
  }

  const snapCurves = snapshot.curveCids.map((cid) => curvesById.get(cid)!)
  const discount = snapCurves.find((c) => c.curveType === 'Discount' && c.currency === valuationCcy)
  if (!discount) {
    throw new Error(`buildContextFromSnapshot: no Discount curve for ${valuationCcy} in snapshot`)
  }

  const snapIndices = snapshot.indexCids.map((cid) => indicesById.get(cid)!)
  const primaryIndex = snapIndices[0] ?? null
  const observations = primaryIndex
    ? flattenObservations(allObs, primaryIndex.indexId, snapshot.observationCutoff)
    : []

  // XCCY / FPML / BASIS need per-ccy curve routing via CurveBook and
  // optional FX translation. Populated only when the snapshot explicitly
  // carried those CIDs (index.ts guards on `needsFx`) so single-ccy
  // snapshots keep exactly the same shape they always had.
  const book = snapshot.bookCurveCids
    ? buildCurveBook(snapshot.bookCurveCids, curvesById)
    : undefined
  const fxSpots = snapshot.fxSpotCids ? await fetchFxSpots(client, snapshot.fxSpotCids) : undefined

  return {
    curve: toDiscountCurve(discount),
    index: primaryIndex ? toFloatingRateIndex(primaryIndex) : null,
    observations,
    ...(book ? { book } : {}),
    ...(fxSpots ? { fxSpots } : {}),
  }
}

function buildCurveBook(cids: string[], curvesById: Map<string, CurvePayload>): CurveBook {
  type Pending = { discount?: DiscountCurve; projections: Record<string, DiscountCurve> }
  const pairs: Record<string, Pending> = {}
  let asOf: string | null = null
  for (const cid of cids) {
    const p = curvesById.get(cid)
    if (!p) throw new Error(`buildCurveBook: curve ${cid} missing from ledger`)
    const curve = toDiscountCurve(p)
    asOf = asOf ?? curve.asOf
    const existing = pairs[p.currency] ?? { projections: {} }
    if (curve.curveType === 'Discount') {
      existing.discount = curve
    } else if (p.indexId) {
      existing.projections[p.indexId] = curve
    }
    pairs[p.currency] = existing
  }
  const paired: CurveBook['byCurrency'] = {}
  for (const [ccy, pair] of Object.entries(pairs)) {
    if (pair.discount && Object.keys(pair.projections).length > 0) {
      paired[ccy] = { discount: pair.discount, projections: pair.projections }
    }
  }
  return { asOf: asOf ?? new Date().toISOString(), byCurrency: paired }
}

interface FxSpotPayload {
  baseCcy: string
  quoteCcy: string
  rate: string
}

async function fetchFxSpots(client: LedgerClient, cids: string[]): Promise<Record<string, number>> {
  const all = (await client.query(FX_SPOT_TEMPLATE_ID)) as Array<{
    contractId: string
    payload: FxSpotPayload
  }>
  const byId = new Map(all.map((r) => [r.contractId, r.payload]))
  const out: Record<string, number> = {}
  for (const cid of cids) {
    const p = byId.get(cid)
    if (!p) throw new Error(`fetchFxSpots: fxSpot ${cid} missing from ledger`)
    out[`${p.baseCcy}${p.quoteCcy}`] = parseFloat(p.rate)
  }
  return out
}

/**
 * Resolve a SwapWorkflow contract id to a SwapConfig the pricer can use.
 *
 * Phase 6 Stage B scope: IRS / OIS / CDS / BASIS / XCCY / FPML — every
 * family the demo's netting set can hold. CCY / FX / ASSET are deprecated
 * (replaced by FPML-shaped instruments) and throw loudly so a mistakenly
 * routed legacy contract doesn't silently mis-mark.
 */
export async function resolveSwapConfig(
  client: LedgerClient,
  swapWorkflowCid: string,
): Promise<SwapConfig> {
  const wfs = (await client.query(SWAP_WORKFLOW_TEMPLATE_ID)) as Array<{
    contractId: string
    payload: SwapWorkflow
  }>
  const wf = wfs.find((w) => w.contractId === swapWorkflowCid)
  if (!wf) {
    throw new Error(`resolveSwapConfig: workflow ${swapWorkflowCid} not on ledger`)
  }

  switch (wf.payload.swapType) {
    case 'IRS':
    case 'OIS':
      return await resolveIrsLike(client, wf)
    case 'CDS':
      return await resolveCds(client, wf)
    case 'BASIS':
      return await resolveBasis(client, wf)
    case 'XCCY':
      return await resolveXccy(client, wf)
    case 'FPML':
    case 'FpML':
      return await resolveFpml(client, wf)
    case 'CCY':
    case 'FX':
    case 'ASSET':
      throw new Error(
        `resolveSwapConfig: ${wf.payload.swapType} deprecated/disabled — not in replay scope`,
      )
    default:
      throw new Error(`resolveSwapConfig: unknown swapType ${wf.payload.swapType}`)
  }
}
