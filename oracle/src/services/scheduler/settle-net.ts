import type { LedgerClient } from '../../shared/ledger-client.js'
import {
  CSA_TEMPLATE_ID,
  NETTED_BATCH_TEMPLATE_ID,
  SWAP_WORKFLOW_TEMPLATE_ID,
} from '../../shared/template-ids.js'
import { type EffectRow, queryAllEffects } from './effect-discovery.js'
import { type InstrumentKey, resolveAllCurrencyHoldings } from './holdings-resolver.js'
import type { TickResult } from './index.js'
import type { SetupDiscovery } from './setup-discovery.js'

interface CsaRow {
  contractId: string
  payload: { partyA: string; partyB: string; valuationCcy?: string }
}

interface SwapRow {
  contractId: string
  payload: {
    partyA: string
    partyB: string
    instrumentKey: InstrumentKey
  }
}

interface BatchRow {
  contractId: string
  payload: { settledEffects: string[] }
}

/**
 * For every CSA on the ledger:
 *  1. Gather the swaps in its netting set (same partyA/partyB).
 *  2. Collect their unsettled Effects — any Effect whose cid is not in
 *     the flattened `NettedBatch.settledEffects` set.
 *  3. Bin by `eventTime` so each on-chain `SettleNetByScheduler` call
 *     covers exactly one (CSA, paymentTimestamp) pair.
 *  4. Pass all pair-aware per-ccy holdings to the choice and let
 *     `Csa.SettleNetByScheduler`'s body compute the signed net per ccy
 *     — the off-chain replay-prediction optimization is out of scope
 *     for the demo-first C2 pass (the choice already drops zero-nets).
 *
 * Idempotency is purely on-chain: a re-run picks up any Effect that
 * didn't land in a `NettedBatch.settledEffects` last tick, so partial
 * failures self-heal on the next cron fire.
 */
export async function settleNetTick(
  client: LedgerClient,
  _now: Date,
  setup: SetupDiscovery,
): Promise<TickResult> {
  const csas = (await client.query(CSA_TEMPLATE_ID)) as CsaRow[]
  if (csas.length === 0) return { fired: 0, skipped: 0, errors: [] }

  const swaps = (await client.query(SWAP_WORKFLOW_TEMPLATE_ID)) as SwapRow[]
  const effects = await queryAllEffects(client)
  const batches = (await client.query(NETTED_BATCH_TEMPLATE_ID)) as BatchRow[]
  const consumed = new Set<string>(batches.flatMap((b) => b.payload.settledEffects))

  let fired = 0
  let skipped = 0
  const errors: TickResult['errors'] = []

  for (const csa of csas) {
    try {
      // Match swaps in either orientation: a workflow proposed by
      // PartyB→PartyA contributes to the same CSA exposure as one
      // proposed by PartyA→PartyB. We tag orientation per entry so the
      // Daml choice can flip the sign for reversed swaps.
      const csaSwaps = swaps.filter(
        (s) =>
          (s.payload.partyA === csa.payload.partyA && s.payload.partyB === csa.payload.partyB) ||
          (s.payload.partyA === csa.payload.partyB && s.payload.partyB === csa.payload.partyA),
      )
      if (csaSwaps.length === 0) {
        skipped++
        continue
      }

      const instToSwap = new Map<string, SwapRow>(
        csaSwaps.map((s) => [s.payload.instrumentKey.id.unpack, s]),
      )

      const unsettled = effects.filter(
        (e) => instToSwap.has(e.payload.targetInstrument.id.unpack) && !consumed.has(e.contractId),
      )
      if (unsettled.length === 0) {
        skipped++
        continue
      }

      const bins = binEffectsByTimestamp(unsettled)
      const holdings = await resolveAllCurrencyHoldings(
        client,
        csa.payload.partyA,
        csa.payload.partyB,
      )

      for (const [paymentTimestamp, binEffects] of bins) {
        try {
          const entries = buildEntries(binEffects, instToSwap, csa.payload.partyA)
          await client.exercise({
            templateId: CSA_TEMPLATE_ID,
            contractId: csa.contractId,
            choice: 'SettleNetByScheduler',
            argument: {
              paymentTimestamp,
              entries,
              holdings,
              settlementFactoryCid: setup.settlementFactoryCid,
              routeProviderCid: setup.routeProviderCid,
            },
          })
          fired++
        } catch (err) {
          errors.push({
            context: `csa=${csa.contractId} bin=${paymentTimestamp}`,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    } catch (err) {
      errors.push({
        context: `csa=${csa.contractId}`,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { fired, skipped, errors }
}

function binEffectsByTimestamp(effects: EffectRow[]): Map<string, EffectRow[]> {
  const bins = new Map<string, EffectRow[]>()
  for (const e of effects) {
    const ts = e.payload.eventTime
    if (!bins.has(ts)) bins.set(ts, [])
    bins.get(ts)?.push(e)
  }
  return bins
}

function buildEntries(
  effects: EffectRow[],
  instToSwap: Map<string, SwapRow>,
  csaPartyA: string,
): Array<{
  swapWorkflowCid: string
  effectCids: string[]
  instrumentKey: InstrumentKey
  reversed: boolean
}> {
  const bySwap = new Map<string, EffectRow[]>()
  for (const e of effects) {
    const instId = e.payload.targetInstrument.id.unpack
    const swap = instToSwap.get(instId)
    if (!swap) continue
    const key = swap.contractId
    if (!bySwap.has(key)) bySwap.set(key, [])
    bySwap.get(key)?.push(e)
  }
  return Array.from(bySwap.entries()).map(([swapCid, es]) => {
    const firstInstId = es[0].payload.targetInstrument.id.unpack
    const swap = instToSwap.get(firstInstId)!
    return {
      swapWorkflowCid: swapCid,
      effectCids: es.map((e) => e.contractId),
      instrumentKey: swap.payload.instrumentKey,
      reversed: swap.payload.partyA !== csaPartyA,
    }
  })
}
