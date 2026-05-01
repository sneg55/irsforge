import type { LedgerClient } from '../../shared/ledger-client.js'
import type { TickResult } from './index.js'
import { matureTick } from './mature.js'
import { settleNetTick } from './settle-net.js'
import type { SetupDiscovery } from './setup-discovery.js'
import { triggerLifecycleTick } from './trigger-lifecycle.js'

export interface FullTickResult {
  trigger: TickResult
  settleNet: TickResult
  mature: TickResult
}

/**
 * Run all three ticks in the mandatory order — trigger, settle-net,
 * mature — for tests and the sandbox E2E. The Cron-driven production
 * path fires each tick independently so the three cadences can diverge,
 * but when a swap matures in the same tick cycle its final Effect was
 * created, ordering matters: Evolve must run before SettleNet so the
 * Effect exists; SettleNet must run before Mature so the `effectsForInstrument`
 * check in matureTick sees a fully-consumed Effect list.
 */
export async function runFullTick(
  client: LedgerClient,
  now: Date,
  setup: SetupDiscovery,
): Promise<FullTickResult> {
  const trigger = await triggerLifecycleTick(client, now, setup)
  const settleNet = await settleNetTick(client, now, setup)
  const mature = await matureTick(client, now, setup)
  return { trigger, settleNet, mature }
}
