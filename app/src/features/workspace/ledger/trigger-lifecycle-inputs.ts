import type { LedgerClient } from '@/shared/ledger/client'
import type { SwapInstrumentPayload } from '@/shared/ledger/swap-instrument-types'
import { OBSERVATION_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { CashSetupRecord } from '@/shared/ledger/types'
import type { ObservablesConfig, SwapType } from '../types'
import { resolveRateIdsForSwap } from './resolve-rate-ids'

// EventFactory lives in the IRSForge package — leave the 1-colon template
// ID unqualified so LedgerClient.qualifyTemplateId prepends IRSFORGE_PACKAGE_ID.
const EVENT_FACTORY_TEMPLATE = 'Setup.EventFactory:EventFactory'

type ContractResult<T> = { contractId: string; payload: T }

interface ObservationPayload {
  provider: string
  id: { unpack: string }
  observations: Record<string, string>
  observers: Record<string, string[]>
}

export interface TriggerLifecycleInputs {
  lifecycleRuleCid: string
  eventCid: string
  observableCids: string[]
}

/**
 * Distinct error class so callers can recognise the "observations missing"
 * failure mode without string-matching — useful for the ASSET gating flow,
 * where we want to tell the user "oracle feeds not yet published" rather
 * than surface a raw error.
 */
export class TriggerLifecycleError extends Error {
  constructor(
    message: string,
    public readonly missingRateIds: string[] = [],
  ) {
    super(message)
    this.name = 'TriggerLifecycleError'
  }
}

/**
 * Compose the three args `Swap.Workflow:TriggerLifecycle` needs:
 *   - lifecycleRuleCid — the Init-created Rule (cached in CashSetupRecord)
 *   - eventCid         — a fresh DateClockUpdateEvent created here
 *   - observableCids   — Observation contracts whose rateId matches the
 *                        swap family's configured observables
 *
 * Dispatches on `swapType` via `resolveRateIdsForSwap`:
 *   - IRS → query Observations for config.observables.IRS.rateIds
 *   - CDS → query Observations for per-refName CDS rate ids
 *   - CCY/FX/FpML → skip observations entirely (`observableCids = []`)
 *   - ASSET → disabled means empty, enabled means per-asset lookup
 *
 * Creates the event inline so one TRIGGER FIXING click becomes two exercises:
 * first CreateFixingEvent on the EventFactory, then TriggerLifecycle on the
 * SwapWorkflow.
 */
export async function resolveTriggerLifecycleInputs(
  client: LedgerClient,
  args: {
    swapType: SwapType
    instrument: SwapInstrumentPayload | null
    observablesConfig: ObservablesConfig
    eventDate: string
  },
): Promise<TriggerLifecycleInputs> {
  const [cashRecord] = await client.query<ContractResult<CashSetupRecord>>(
    'Setup.CashSetup:CashSetupRecord',
  )
  if (!cashRecord) throw new TriggerLifecycleError('Cash infrastructure not provisioned')

  const { lifecycleRuleCid, eventFactoryCid } = cashRecord.payload

  // 1. Create the fixing event for the requested date via the EventFactory.
  const createResult = await client.exercise(
    EVENT_FACTORY_TEMPLATE,
    eventFactoryCid,
    'CreateFixingEvent',
    { eventDate: args.eventDate },
  )
  const eventCid = extractExerciseResult(createResult)
  if (!eventCid)
    throw new TriggerLifecycleError('EventFactory.CreateFixingEvent returned no contract ID')

  // 2. Resolve the rate ids this swap family needs observations for.
  const rateIds = resolveRateIdsForSwap(args.swapType, args.instrument, args.observablesConfig)

  // Families with no external observations (CCY/FX/FpML, ASSET disabled)
  // skip the Observation query entirely — lifecycle rule takes [].
  if (rateIds.length === 0) {
    return { lifecycleRuleCid, eventCid, observableCids: [] }
  }

  // 3. Look up the Observation contracts whose unpacked id matches any rateId.
  const observations =
    await client.query<ContractResult<ObservationPayload>>(OBSERVATION_TEMPLATE_ID)
  const obsById = new Map(observations.map((o) => [o.payload.id.unpack, o.contractId]))

  const observableCids: string[] = []
  const missing: string[] = []
  for (const rateId of rateIds) {
    const cid = obsById.get(rateId)
    if (cid) observableCids.push(cid)
    else missing.push(rateId)
  }

  if (missing.length > 0) {
    throw new TriggerLifecycleError(
      `No Observation contracts found for rateId(s): ${missing.join(', ')}`,
      missing,
    )
  }

  return { lifecycleRuleCid, eventCid, observableCids }
}

/**
 * JSON API exercise response shape: `{ result: { exerciseResult, events } }`.
 * The exerciseResult for a choice that returns `ContractId X` is the cid
 * string. The LedgerClient.exercise helper returns the raw response body;
 * this narrows it.
 */
function extractExerciseResult(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null
  const result = (raw as { result?: { exerciseResult?: unknown } }).result
  if (!result) return null
  const value = result.exerciseResult
  return typeof value === 'string' ? value : null
}
