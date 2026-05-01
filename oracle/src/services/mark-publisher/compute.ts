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
   * MUST return a `SwapConfig` already re-signed to PartyA's perspective.
   * Adapter is responsible for negating PV sign when PartyB is the
   * proposer. computeMark then sums and flips sign per spec convention.
   *
   * Async to match the Stage D replay adapters (`resolveSwapConfig` in
   * replay.ts queries the ledger). Sync fakes are still valid — just
   * wrap the return in `Promise.resolve(...)`.
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
  const swapPvs = (
    await Promise.all(
      netting.swaps.map(async (s) => {
        try {
          const cfg = await deps.resolveSwapConfig(s.contractId)
          const { npv } = pricingEngine.price(cfg, ctx)
          return { swapCid: s.contractId, pv: npv }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          // deprecated/out-of-scope swap types (CCY/FX/ASSET) return no PV
          // rather than poisoning the whole CSA mark.
          if (/deprecated\/disabled/.test(msg)) return null
          throw err
        }
      }),
    )
  ).filter((x): x is { swapCid: string; pv: number } => x !== null)
  // Each PV is already in PartyA's perspective (positive = PA ITM).
  // Spec convention for exposure: positive ⇒ A owes B, so flip sign.
  const sumPa = swapPvs.reduce((acc, x) => acc + x.pv, 0)
  return { exposure: -sumPa, asOf: deps.asOf(), swapPvs }
}
