import type { LedgerClient } from '../../shared/ledger-client.js'
import {
  MATURED_SWAP_TEMPLATE_ID,
  NETTED_BATCH_TEMPLATE_ID,
  SWAP_WORKFLOW_TEMPLATE_ID,
} from '../../shared/template-ids.js'
import { queryAllEffects } from './effect-discovery.js'
import type { TickResult } from './index.js'
import { fetchAllMaturityDates } from './instrument-maturity.js'
import type { SetupDiscovery } from './setup-discovery.js'

interface SwapRow {
  contractId: string
  payload: {
    partyA: string
    partyB: string
    instrumentKey: { id: { unpack: string } }
  }
}

interface MaturedSwapRow {
  payload: { instrumentKey: { id: { unpack: string } } }
}

interface BatchRow {
  payload: { settledEffects: string[] }
}

/**
 * Retires a swap when three conditions hold:
 *   1. No existing `MaturedSwap` for the instrument.
 *   2. The instrument's on-chain maturity date is `<= now` (per-family
 *      `periodicSchedule.terminationDate` or `maturityDate`).
 *   3. Every Effect targeting the instrument has been consumed by a
 *      `NettedBatch` — i.e., its cid appears in some batch's
 *      `settledEffects`.
 *
 * Matures with `effectCids = []` + `null` holdings because the final
 * coupon (if any) was already settled by the settle-net tick earlier in
 * the same tick-cycle; the Mature choice then becomes a pure archival
 * step.
 */
export async function matureTick(
  client: LedgerClient,
  now: Date,
  setup: SetupDiscovery,
): Promise<TickResult> {
  const swaps = (await client.query(SWAP_WORKFLOW_TEMPLATE_ID)) as SwapRow[]
  if (swaps.length === 0) return { fired: 0, skipped: 0, errors: [] }

  const matured = (await client.query(MATURED_SWAP_TEMPLATE_ID)) as MaturedSwapRow[]
  const effects = await queryAllEffects(client)
  const batches = (await client.query(NETTED_BATCH_TEMPLATE_ID)) as BatchRow[]
  const consumed = new Set<string>(batches.flatMap((b) => b.payload.settledEffects))
  const maturityByInst = await fetchAllMaturityDates(client)
  const maturedInstIds = new Set(matured.map((m) => m.payload.instrumentKey.id.unpack))

  const nowIso = now.toISOString().slice(0, 10)

  let fired = 0
  let skipped = 0
  const errors: TickResult['errors'] = []

  for (const swap of swaps) {
    try {
      const instId = swap.payload.instrumentKey.id.unpack
      if (maturedInstIds.has(instId)) {
        skipped++
        continue
      }
      const maturityDate = maturityByInst.get(instId)
      if (!maturityDate || maturityDate > nowIso) {
        skipped++
        continue
      }
      const hasUnsettled = effects.some(
        (e) => e.payload.targetInstrument.id.unpack === instId && !consumed.has(e.contractId),
      )
      if (hasUnsettled) {
        skipped++
        continue
      }

      await client.exercise({
        templateId: SWAP_WORKFLOW_TEMPLATE_ID,
        contractId: swap.contractId,
        choice: 'MatureByScheduler',
        argument: {
          maturityDate,
          actualMaturityDate: nowIso,
          effectCids: [],
          settlementFactoryCid: setup.settlementFactoryCid,
          routeProviderCid: setup.routeProviderCid,
          partyAHoldingCid: null,
          partyBHoldingCid: null,
          partyAAccountKey: setup.partyAAccountKey,
          partyBAccountKey: setup.partyBAccountKey,
          usdInstrumentKey: setup.defaultCurrencyInstrumentKey,
        },
      })
      fired++
    } catch (err) {
      errors.push({
        context: `swap=${swap.contractId}`,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { fired, skipped, errors }
}
