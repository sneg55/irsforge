import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LedgerClient } from '../../../shared/ledger-client.js'
import {
  DAML_FINANCE_EFFECT_TEMPLATE_ID,
  DAML_FINANCE_OBSERVATION_TEMPLATE_ID,
  DATE_CLOCK_UPDATE_EVENT_TEMPLATE_ID,
  SWAP_WORKFLOW_TEMPLATE_ID,
} from '../../../shared/template-ids.js'
import { triggerLifecycleTick } from '../trigger-lifecycle.js'

const setup = {
  schedulerLifecycleRuleCid: 'rule-sched',
  settlementFactoryCid: 'fac',
  routeProviderCid: 'route',
  eventFactoryCid: 'eventfac',
  defaultCurrencyInstrumentKey: {
    depository: 'Op',
    issuer: 'Op',
    id: { unpack: 'USD' },
    version: '0',
    holdingStandard: 'TransferableFungible',
  },
  partyAAccountKey: { custodian: 'Op', owner: 'A', id: { unpack: 'a' } },
  partyBAccountKey: { custodian: 'Op', owner: 'B', id: { unpack: 'b' } },
}

interface QueryMocks {
  swaps?: unknown[]
  effects?: unknown[]
  observations?: unknown[]
  events?: unknown[]
}

function makeClient(mocks: QueryMocks, exerciseFn?: (cmd: unknown) => unknown): LedgerClient {
  const query = vi.fn(async (templateId: string) => {
    if (templateId === SWAP_WORKFLOW_TEMPLATE_ID) return mocks.swaps ?? []
    if (templateId === DAML_FINANCE_EFFECT_TEMPLATE_ID) return mocks.effects ?? []
    if (templateId === DAML_FINANCE_OBSERVATION_TEMPLATE_ID) return mocks.observations ?? []
    if (templateId === DATE_CLOCK_UPDATE_EVENT_TEMPLATE_ID) return mocks.events ?? []
    return []
  })
  const exercise = vi.fn(async (cmd: unknown) => {
    if (exerciseFn) return exerciseFn(cmd)
    const choice = (cmd as { choice: string }).choice
    // Default: CreateFixingEventByScheduler returns a fresh event cid;
    // TriggerLifecycleByScheduler returns [Some instrument, effectCids].
    if (choice === 'CreateFixingEventByScheduler') {
      return { result: { exerciseResult: 'new-event-cid' } }
    }
    return { result: { exerciseResult: [null, []] } }
  })
  return { query, exercise } as unknown as LedgerClient
}

const swap = (contractId: string, instrumentId: string) => ({
  contractId,
  payload: {
    swapType: 'IRS',
    operator: 'Op',
    partyA: 'A',
    partyB: 'B',
    regulators: ['R'],
    scheduler: 'Sch',
    instrumentKey: {
      depository: 'Op',
      issuer: 'Op',
      id: { unpack: instrumentId },
      version: '0',
      holdingStandard: 'TransferableFungible',
    },
    notional: '1000000',
  },
})

const effect = (instrumentId: string, dateIso: string) => ({
  contractId: `effect-${instrumentId}-${dateIso}`,
  payload: {
    targetInstrument: { id: { unpack: instrumentId } },
    eventTime: `${dateIso}T00:00:00Z`,
  },
})

describe('triggerLifecycleTick', () => {
  let now: Date
  beforeEach(() => {
    now = new Date('2026-04-19T12:00:00Z')
  })

  it('fires TriggerLifecycleByScheduler for a swap with no Effect today', async () => {
    const client = makeClient({ swaps: [swap('swap-1', 'inst-1')] })
    const r = await triggerLifecycleTick(client, now, setup)
    expect(r.fired).toBe(1)
    expect(r.skipped).toBe(0)
    const calls = (client.exercise as unknown as ReturnType<typeof vi.fn>).mock.calls
    const trigger = calls.find((c) => c[0].choice === 'TriggerLifecycleByScheduler')
    expect(trigger).toBeDefined()
    expect(trigger![0]).toMatchObject({
      contractId: 'swap-1',
      choice: 'TriggerLifecycleByScheduler',
      argument: {
        lifecycleRuleCid: 'rule-sched',
        eventCid: 'new-event-cid',
      },
    })
  })

  it('skips a swap whose Effect already exists for today (idempotency)', async () => {
    const client = makeClient({
      swaps: [swap('swap-1', 'inst-1')],
      effects: [effect('inst-1', '2026-04-19')],
    })
    const r = await triggerLifecycleTick(client, now, setup)
    expect(r.fired).toBe(0)
    expect(r.skipped).toBe(1)
  })

  it('passes all observation cids to Evolve', async () => {
    const client = makeClient({
      swaps: [swap('swap-1', 'inst-1')],
      observations: [{ contractId: 'obs-sofr' }, { contractId: 'obs-libor' }],
    })
    await triggerLifecycleTick(client, now, setup)
    const calls = (client.exercise as unknown as ReturnType<typeof vi.fn>).mock.calls
    const trigger = calls.find((c) => c[0].choice === 'TriggerLifecycleByScheduler')
    expect(trigger![0].argument.observableCids).toEqual(['obs-sofr', 'obs-libor'])
  })

  it('reuses an existing DateClockUpdateEvent for today instead of creating a new one', async () => {
    const client = makeClient({
      swaps: [swap('swap-1', 'inst-1')],
      events: [{ contractId: 'existing-event', payload: { date: '2026-04-19' } }],
    })
    await triggerLifecycleTick(client, now, setup)
    const calls = (client.exercise as unknown as ReturnType<typeof vi.fn>).mock.calls
    const creations = calls.filter((c) => c[0].choice === 'CreateFixingEventByScheduler')
    expect(creations.length).toBe(0)
    const trigger = calls.find((c) => c[0].choice === 'TriggerLifecycleByScheduler')
    expect(trigger![0].argument.eventCid).toBe('existing-event')
  })

  it('collects per-swap exercise errors, continues with other swaps', async () => {
    const client = makeClient(
      { swaps: [swap('swap-bad', 'inst-bad'), swap('swap-ok', 'inst-ok')] },
      (cmd) => {
        const c = cmd as { choice: string; contractId: string }
        if (c.choice === 'CreateFixingEventByScheduler') {
          return { result: { exerciseResult: 'new-event-cid' } }
        }
        if (c.contractId === 'swap-bad') throw new Error('boom')
        return { result: { exerciseResult: [null, []] } }
      },
    )
    const r = await triggerLifecycleTick(client, now, setup)
    expect(r.fired).toBe(1)
    expect(r.errors.length).toBe(1)
    expect(r.errors[0].context).toContain('swap-bad')
  })
})
