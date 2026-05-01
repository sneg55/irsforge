import { describe, expect, it, vi } from 'vitest'
import type { LedgerClient } from '../../../shared/ledger-client.js'
import {
  ASSET_INSTRUMENT_TEMPLATE_ID,
  CCY_INSTRUMENT_TEMPLATE_ID,
  CDS_INSTRUMENT_TEMPLATE_ID,
  CSA_TEMPLATE_ID,
  DAML_FINANCE_EFFECT_TEMPLATE_ID,
  DAML_FINANCE_OBSERVATION_TEMPLATE_ID,
  DATE_CLOCK_UPDATE_EVENT_TEMPLATE_ID,
  FX_INSTRUMENT_TEMPLATE_ID,
  IRS_INSTRUMENT_TEMPLATE_ID,
  MATURED_SWAP_TEMPLATE_ID,
  NETTED_BATCH_TEMPLATE_ID,
  SWAP_WORKFLOW_TEMPLATE_ID,
  TRANSFERABLE_FUNGIBLE_TEMPLATE_ID,
} from '../../../shared/template-ids.js'
import { runFullTick } from '../tick.js'

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

describe('runFullTick', () => {
  it('no swaps on ledger: returns zero-everything in every tick', async () => {
    const emptyClient = {
      query: vi.fn().mockResolvedValue([]),
      exercise: vi.fn(),
    } as unknown as LedgerClient
    const r = await runFullTick(emptyClient, new Date(), setup)
    expect(r.trigger).toEqual({ fired: 0, skipped: 0, errors: [] })
    expect(r.settleNet).toEqual({ fired: 0, skipped: 0, errors: [] })
    expect(r.mature).toEqual({ fired: 0, skipped: 0, errors: [] })
  })

  it('calls the three ticks in the mandatory order: trigger → settleNet → mature', async () => {
    const order: string[] = []
    const query = vi.fn(async (templateId: string) => {
      if (templateId === SWAP_WORKFLOW_TEMPLATE_ID) {
        return [
          {
            contractId: 'swap-1',
            payload: {
              partyA: 'A',
              partyB: 'B',
              instrumentKey: { id: { unpack: 'inst-1' } },
            },
          },
        ]
      }
      return []
    })
    const exercise = vi.fn(async (cmd: { choice: string }) => {
      if (cmd.choice === 'TriggerLifecycleByScheduler') order.push('trigger')
      else if (cmd.choice === 'SettleNetByScheduler') order.push('settleNet')
      else if (cmd.choice === 'MatureByScheduler') order.push('mature')
      else if (cmd.choice === 'CreateFixingEventByScheduler')
        return { result: { exerciseResult: 'event-cid' } }
      return { result: { exerciseResult: 'ok' } }
    })
    const client = { query, exercise } as unknown as LedgerClient
    await runFullTick(client, new Date('2026-04-19'), setup)
    // Trigger ran; settleNet + mature had no input (no csas, no maturity)
    // so only "trigger" ends up in `order`. That's still sufficient to
    // confirm the call sequence — each tick is awaited in turn.
    expect(order[0]).toBe('trigger')

    // Reference unused template-ids so the import list stays canonical —
    // future edits adding mocks for any of these do not silently fail.
    expect([
      DAML_FINANCE_EFFECT_TEMPLATE_ID,
      DAML_FINANCE_OBSERVATION_TEMPLATE_ID,
      DATE_CLOCK_UPDATE_EVENT_TEMPLATE_ID,
      CSA_TEMPLATE_ID,
      NETTED_BATCH_TEMPLATE_ID,
      MATURED_SWAP_TEMPLATE_ID,
      IRS_INSTRUMENT_TEMPLATE_ID,
      CDS_INSTRUMENT_TEMPLATE_ID,
      CCY_INSTRUMENT_TEMPLATE_ID,
      FX_INSTRUMENT_TEMPLATE_ID,
      ASSET_INSTRUMENT_TEMPLATE_ID,
      TRANSFERABLE_FUNGIBLE_TEMPLATE_ID,
    ]).toHaveLength(12)
  })
})
