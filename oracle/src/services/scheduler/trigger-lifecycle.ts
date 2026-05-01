import type { LedgerClient } from '../../shared/ledger-client.js'
import { SWAP_WORKFLOW_TEMPLATE_ID } from '../../shared/template-ids.js'
import { effectExistsFor, queryAllEffects } from './effect-discovery.js'
import type { TickResult } from './index.js'
import { ensureFixingEventForDate, queryAllObservations } from './instrument-events.js'
import type { SetupDiscovery } from './setup-discovery.js'

interface SwapWorkflowRow {
  contractId: string
  payload: {
    instrumentKey: { id: { unpack: string } }
  }
}

/**
 * Fires `TriggerLifecycleByScheduler` for every SwapWorkflow whose
 * instrument has no Effect for today. Idempotency is purely effect-based:
 * if Evolve produced an Effect dated today the swap is skipped next
 * tick. Engines that produce zero effects on a non-payment day re-fire
 * on subsequent ticks — inexpensive at demo scale, and the right tradeoff
 * vs. tracking per-service state.
 *
 * One fixing event is reused across every swap in a tick: the first
 * swap triggers `ensureFixingEventForDate`, later swaps reuse its cid.
 */
export async function triggerLifecycleTick(
  client: LedgerClient,
  now: Date,
  setup: SetupDiscovery,
): Promise<TickResult> {
  const todayIso = now.toISOString().slice(0, 10)

  const swaps = (await client.query(SWAP_WORKFLOW_TEMPLATE_ID)) as SwapWorkflowRow[]
  if (swaps.length === 0) return { fired: 0, skipped: 0, errors: [] }

  const effects = await queryAllEffects(client)
  const observableCids = await queryAllObservations(client)

  let eventCid: string | null = null
  let fired = 0
  let skipped = 0
  const errors: TickResult['errors'] = []

  for (const swap of swaps) {
    try {
      const instrumentId = swap.payload.instrumentKey.id.unpack
      if (effectExistsFor(effects, instrumentId, todayIso)) {
        skipped++
        continue
      }

      if (eventCid === null) {
        eventCid = await ensureFixingEventForDate(client, setup.eventFactoryCid, todayIso)
      }

      await client.exercise({
        templateId: SWAP_WORKFLOW_TEMPLATE_ID,
        contractId: swap.contractId,
        choice: 'TriggerLifecycleByScheduler',
        argument: {
          lifecycleRuleCid: setup.schedulerLifecycleRuleCid,
          eventCid,
          observableCids,
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
