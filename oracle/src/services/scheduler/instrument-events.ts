import type { LedgerClient } from '../../shared/ledger-client.js'
import {
  DAML_FINANCE_OBSERVATION_TEMPLATE_ID,
  DATE_CLOCK_UPDATE_EVENT_TEMPLATE_ID,
  EVENT_FACTORY_TEMPLATE_ID,
} from '../../shared/template-ids.js'

interface DateClockUpdateEventRow {
  contractId: string
  payload: { date: string }
}

/**
 * Return every observation cid on the ledger. Daml Finance's `Evolve`
 * filters by rate id internally, so passing the full set is safe —
 * engines pick what they need. Saves the scheduler from replicating the
 * per-family rate-id dispatch already living in
 * `app/src/features/workspace/ledger/resolve-rate-ids.ts`.
 */
export async function queryAllObservations(client: LedgerClient): Promise<string[]> {
  const rows = (await client.query(DAML_FINANCE_OBSERVATION_TEMPLATE_ID)) as Array<{
    contractId: string
  }>
  return rows.map((r) => r.contractId)
}

/**
 * Ensure a `DateClockUpdateEvent` exists for `dateIso`, returning its
 * contract id. Reuses a pre-existing event across swaps in the same tick
 * so one tick produces at most one new event contract regardless of
 * how many swaps are triggered.
 *
 * Calls `EventFactory.CreateFixingEventByScheduler` — the sister choice
 * added with this stage so the scheduler JWT (actAs=[Scheduler]) can
 * produce events without impersonating the operator.
 */
export async function ensureFixingEventForDate(
  client: LedgerClient,
  eventFactoryCid: string,
  dateIso: string,
): Promise<string> {
  const rows = (await client.query(
    DATE_CLOCK_UPDATE_EVENT_TEMPLATE_ID,
  )) as DateClockUpdateEventRow[]
  const existing = rows.find((r) => r.payload.date === dateIso)
  if (existing) return existing.contractId

  const result = await client.exercise({
    templateId: EVENT_FACTORY_TEMPLATE_ID,
    contractId: eventFactoryCid,
    choice: 'CreateFixingEventByScheduler',
    argument: { eventDate: dateIso },
  })
  const cid = extractExerciseResult(result)
  if (!cid) {
    throw new Error(
      'ensureFixingEventForDate: CreateFixingEventByScheduler returned no contract id',
    )
  }
  return cid
}

function extractExerciseResult(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null
  const result = (raw as { result?: { exerciseResult?: unknown } }).result
  if (!result) return null
  const value = result.exerciseResult
  return typeof value === 'string' ? value : null
}
