import type { PricingContext, SwapConfig } from '@irsforge/shared-pricing'
import { pricingEngine } from '@irsforge/shared-pricing'
import type { DecodedCsa } from './decode.js'
import type { NettingSetEntry } from './netting-set.js'

export interface MarkComputation {
  /** Signed, in valuationCcy. Convention: positive ⇒ partyA owes partyB. */
  exposure: number
  asOf: string
  swapPvs: Array<{ swapCid: string; pv: number }>
}

export interface ComputeDeps {
  asOf: () => string
  /**
   * Return the SwapConfig for `cid` in the swap's *own owner* frame —
   * i.e. positive PV means the workflow's partyA (the holding owner) is
   * ITM. This adapter has no CSA context, so it cannot orient PVs to
   * csa.partyA. computeMark re-signs per entry using the `reversed`
   * flag carried on `NettingSetEntry.swaps` (set by `groupByNettingSet`
   * when swap.partyA !== csa.partyA).
   *
   * Async to match the Stage D replay adapters (`resolveSwapConfig` in
   * replay.ts queries the ledger). Sync fakes are still valid — wrap in
   * Promise.resolve.
   */
  resolveSwapConfig: (cid: string) => SwapConfig | Promise<SwapConfig>
  resolveCtx: (currency: string) => PricingContext | Promise<PricingContext>
}

export async function computeMark(
  csa: DecodedCsa,
  netting: NettingSetEntry,
  deps: ComputeDeps,
): Promise<MarkComputation> {
  const ctx = await deps.resolveCtx(csa.valuationCcy)
  // Errors from resolveSwapConfig propagate. A live unsupported swap
  // (CCY/FX/ASSET, etc.) under an active CSA must surface visibly: the
  // publisher's outer try/catch records `csa_publish_failed` and skips
  // the CSA so it shows up in error counts and logs. Silently dropping
  // such a swap would understate exposure and could leave the CSA
  // under-collateralised without surfacing the problem.
  const swapPvs = await Promise.all(
    netting.swaps.map(async (s) => {
      const cfg = await deps.resolveSwapConfig(s.contractId)
      const { npv } = pricingEngine.price(cfg, ctx)
      // For workflows proposed B→A inside an A/B CSA, the pricer's
      // npv is in B's frame. Flip into csa.partyA's frame so the
      // netted exposure has a single, consistent orientation.
      const signed = s.reversed ? -npv : npv
      return { swapCid: s.contractId, pv: signed }
    }),
  )
  // Every PV is now in csa.partyA's frame (positive = A ITM). Spec
  // convention for exposure: positive ⇒ A owes B, so flip sign.
  const sumPa = swapPvs.reduce((acc, x) => acc + x.pv, 0)
  return { exposure: -sumPa, asOf: deps.asOf(), swapPvs }
}
