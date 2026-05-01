import type { LedgerClient } from '../../shared/ledger-client.js'
import type { Logger } from '../../shared/logger.js'
import {
  CSA_TEMPLATE_ID,
  CURVE_TEMPLATE_ID,
  FLOATING_RATE_INDEX_TEMPLATE_ID,
  FX_SPOT_TEMPLATE_ID,
  SWAP_WORKFLOW_TEMPLATE_ID,
} from '../../shared/template-ids.js'
import type { CsaPayload, SwapWorkflow } from '../../shared/types.js'
import { type ComputeDeps, computeMark } from './compute.js'
import { type DecodedCsa, decodeCsa } from './decode.js'
import { groupByNettingSet } from './netting-set.js'
import { CsaPublisher } from './publisher.js'
import { buildContextFromSnapshot } from './replay.js'
import type { SnapshotKey } from './replay-types.js'
import { buildSnapshot } from './snapshot.js'

export interface MarkPublisherDeps {
  client: LedgerClient
  logger: Logger
  computeDeps: ComputeDeps
  cron: string
}

export interface TickResult {
  marked: number
  settled: number
  errors: number
}

export class MarkPublisherService {
  private readonly publisher: CsaPublisher

  constructor(private readonly deps: MarkPublisherDeps) {
    this.publisher = new CsaPublisher(deps.client, deps.logger)
  }

  /** One polling pass: query CSAs + SwapWorkflows, recompute marks, publish, maybe settle. */
  async tick(): Promise<TickResult> {
    const csasRaw = (await this.deps.client.query(CSA_TEMPLATE_ID)) as Array<{
      contractId: string
      payload: CsaPayload
    }>
    const csas: DecodedCsa[] = csasRaw.map((c) => decodeCsa(c.contractId, c.payload))

    const workflows = (await this.deps.client.query(SWAP_WORKFLOW_TEMPLATE_ID)) as Array<{
      contractId: string
      payload: SwapWorkflow
    }>

    const nettingSets = groupByNettingSet(
      csas.map((c) => ({
        contractId: c.contractId,
        payload: { partyA: c.partyA, partyB: c.partyB },
      })),
      workflows,
    )

    // Pre-query curves + indices once per tick so the snapshot we write
    // on-chain references the exact same set the resolveCtx call uses.
    // Stage D's replay harness reads that snapshot back and re-builds
    // PricingContext from it — if the publisher's tick used a different
    // set, the harness can never reproduce the publisher's mark.
    const allCurves = (await this.deps.client.query(CURVE_TEMPLATE_ID)) as Array<{
      contractId: string
    }>
    const allIndices = (await this.deps.client.query(FLOATING_RATE_INDEX_TEMPLATE_ID)) as Array<{
      contractId: string
    }>
    const curveCids = allCurves.map((c) => c.contractId)
    const indexCids = allIndices.map((i) => i.contractId)

    // Pre-query FxSpots once per tick — only embedded in the snapshot for
    // CSAs whose netting set actually contains XCCY / FPML / BASIS swaps,
    // so single-currency CSAs keep their snapshot strings unchanged
    // (and stable replay-bisect surface).
    let fxSpotCids: string[] | null = null
    const needsFx = (swapType: string): boolean =>
      swapType === 'XCCY' || swapType === 'FPML' || swapType === 'FpML' || swapType === 'BASIS'

    let marked = 0
    let settled = 0
    let errors = 0

    for (const csa of csas) {
      const ns = nettingSets.find((n) => n.csaCid === csa.contractId)
      if (!ns) continue
      try {
        const asOf = this.deps.computeDeps.asOf()
        const csaNeedsFx = ns.swaps.some((s) => needsFx(s.payload.swapType))
        if (csaNeedsFx && fxSpotCids === null) {
          const allFxSpots = (await this.deps.client.query(FX_SPOT_TEMPLATE_ID)) as Array<{
            contractId: string
          }>
          fxSpotCids = allFxSpots.map((f) => f.contractId)
        }
        const snapshotKey: SnapshotKey = {
          curveCids,
          indexCids,
          observationCutoff: asOf,
          swapCids: ns.swaps.map((s) => s.contractId),
          // Multi-ccy families read their per-ccy curves off a CurveBook
          // (shared-pricing/src/engine/strategies/xccy.ts:45). We reuse the
          // tick-wide curveCids here rather than a tighter subset — the
          // CurveBook picks by currency anyway, and the tick already
          // guarantees the full set is on-ledger.
          ...(csaNeedsFx ? { bookCurveCids: curveCids } : {}),
          ...(csaNeedsFx && fxSpotCids !== null ? { fxSpotCids } : {}),
        }
        const ctx = await buildContextFromSnapshot(this.deps.client, snapshotKey, csa.valuationCcy)
        const mc = await computeMark(csa, ns, {
          asOf: () => asOf,
          resolveSwapConfig: this.deps.computeDeps.resolveSwapConfig,
          resolveCtx: () => ctx,
        })
        const snapshot = buildSnapshot(snapshotKey)
        const { settled: didSettle } = await this.publisher.publishAndMaybeSettle(csa, mc, snapshot)
        marked++
        if (didSettle) settled++
      } catch (err) {
        this.deps.logger.error({
          event: 'csa_publish_failed',
          csaCid: csa.contractId,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        })
        errors++
      }
    }
    return { marked, settled, errors }
  }
}
