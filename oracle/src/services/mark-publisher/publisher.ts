import type { LedgerClient } from '../../shared/ledger-client.js'
import type { Logger } from '../../shared/logger.js'
import { CSA_TEMPLATE_ID } from '../../shared/template-ids.js'
import type { MarkComputation } from './compute.js'
import type { DecodedCsa } from './decode.js'
import { computeRequired, gateCall } from './formula.js'

export interface PublishResult {
  markCid: string
  settled: boolean
}

export class CsaPublisher {
  constructor(
    private readonly client: Pick<LedgerClient, 'exercise'>,
    private readonly logger: Logger,
  ) {}

  /**
   * Exercise `Csa.PublishMark`; when the CSA is Active and the gated call
   * amount is non-zero, chain `Csa.SettleVm`. Returns `{ settled: false }`
   * whenever we skipped the call — either because the state wasn't Active
   * or the gated call was 0 under MTA/rounding.
   */
  async publishAndMaybeSettle(
    csa: DecodedCsa,
    mc: MarkComputation,
    snapshot: string,
  ): Promise<PublishResult> {
    const publish = await this.client.exercise({
      templateId: CSA_TEMPLATE_ID,
      contractId: csa.contractId,
      choice: 'PublishMark',
      argument: {
        asOf: mc.asOf,
        exposure: mc.exposure.toString(),
        snapshot,
      },
    })
    // Canton JSON API wraps successful exercises as `{result: {exerciseResult, events, ...}, status: 200}`,
    // and Daml tuples serialize as records `{_1, _2}`, not JSON arrays —
    // so the destructure has to reach through `.result.exerciseResult`
    // and pull named fields.
    const exerciseResult = (publish as { result: { exerciseResult: { _1: string; _2: string } } })
      .result.exerciseResult
    const csaCid2 = exerciseResult._1
    const markCid = exerciseResult._2

    if (csa.state === 'MarkDisputed' || csa.state === 'Escalated') {
      // Disputed or escalated marks need a human-signed resolution before
      // settlement can resume — `AcknowledgeDispute` (operator) when state
      // is `Escalated`, or either of `AcknowledgeDispute` (operator) /
      // `AgreeToCounterMark` (counterparty) when state is `MarkDisputed`.
      // The publisher records the mark for audit but leaves the state
      // change to a human.
      this.logger.info({
        event: 'csa_mark_published_no_settle_disputed',
        csaCid: csa.contractId,
        markCid,
        state: csa.state,
      })
      return { markCid, settled: false }
    }

    const req = computeRequired(mc.exposure, csa.thresholdDirA, csa.thresholdDirB)
    const postedA = csa.postedByA.get(csa.valuationCcy) ?? 0
    const postedB = csa.postedByB.get(csa.valuationCcy) ?? 0
    const postedNet = postedA - postedB
    const rawCall = req.fromA - req.fromB - postedNet
    const gated = gateCall(rawCall, csa.mta, csa.rounding)

    if (gated === 0 && csa.state === 'Active') {
      // Flat book and nothing to clear — skip the SettleVm round-trip.
      // When state is MarginCallOutstanding we still call SettleVm so the
      // contract can observe the now-flat book and flip the state back to
      // Active; otherwise the CSA stays pinned to Call Out forever.
      return { markCid, settled: false }
    }

    await this.client.exercise({
      templateId: CSA_TEMPLATE_ID,
      contractId: csaCid2,
      choice: 'SettleVm',
      argument: {},
    })
    this.logger.info({
      event: 'csa_settle_vm',
      csaCid: csa.contractId,
      markCid,
      gatedCall: gated,
    })
    return { markCid, settled: true }
  }
}
