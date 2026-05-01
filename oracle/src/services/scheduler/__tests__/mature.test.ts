import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LedgerClient } from '../../../shared/ledger-client.js'
import {
  ASSET_INSTRUMENT_TEMPLATE_ID,
  CCY_INSTRUMENT_TEMPLATE_ID,
  CDS_INSTRUMENT_TEMPLATE_ID,
  DAML_FINANCE_EFFECT_TEMPLATE_ID,
  FX_INSTRUMENT_TEMPLATE_ID,
  IRS_INSTRUMENT_TEMPLATE_ID,
  MATURED_SWAP_TEMPLATE_ID,
  NETTED_BATCH_TEMPLATE_ID,
  SWAP_WORKFLOW_TEMPLATE_ID,
} from '../../../shared/template-ids.js'
import { matureTick } from '../mature.js'

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

const swap = (cid: string, instId: string) => ({
  contractId: cid,
  payload: {
    partyA: 'A',
    partyB: 'B',
    swapType: 'IRS',
    instrumentKey: {
      depository: 'Op',
      issuer: 'Op',
      id: { unpack: instId },
      version: '0',
      holdingStandard: 'TransferableFungible',
    },
    notional: '1000000',
  },
})

const irsInstrument = (id: string, maturity: string) => ({
  payload: { id: { unpack: id }, periodicSchedule: { terminationDate: maturity } },
})

interface Mocks {
  swaps?: unknown[]
  matured?: unknown[]
  effects?: unknown[]
  batches?: unknown[]
  irsInstruments?: unknown[]
}

function makeClient(m: Mocks): LedgerClient {
  const query = vi.fn(async (templateId: string) => {
    if (templateId === SWAP_WORKFLOW_TEMPLATE_ID) return m.swaps ?? []
    if (templateId === MATURED_SWAP_TEMPLATE_ID) return m.matured ?? []
    if (templateId === DAML_FINANCE_EFFECT_TEMPLATE_ID) return m.effects ?? []
    if (templateId === NETTED_BATCH_TEMPLATE_ID) return m.batches ?? []
    if (templateId === IRS_INSTRUMENT_TEMPLATE_ID) return m.irsInstruments ?? []
    if (
      templateId === CDS_INSTRUMENT_TEMPLATE_ID ||
      templateId === CCY_INSTRUMENT_TEMPLATE_ID ||
      templateId === FX_INSTRUMENT_TEMPLATE_ID ||
      templateId === ASSET_INSTRUMENT_TEMPLATE_ID
    )
      return []
    return []
  })
  const exercise = vi.fn(async () => ({ result: { exerciseResult: 'matured-cid' } }))
  return { query, exercise } as unknown as LedgerClient
}

describe('matureTick', () => {
  let now: Date
  beforeEach(() => {
    now = new Date('2027-01-02T12:00:00Z')
  })

  it('fires MatureByScheduler for a swap past maturity with no unsettled effects', async () => {
    const client = makeClient({
      swaps: [swap('swap-1', 'inst-1')],
      irsInstruments: [irsInstrument('inst-1', '2027-01-01')],
    })
    const r = await matureTick(client, now, setup)
    expect(r.fired).toBe(1)
    const calls = (client.exercise as unknown as ReturnType<typeof vi.fn>).mock.calls
    const mature = calls.find((c) => c[0].choice === 'MatureByScheduler')
    expect(mature).toBeDefined()
    expect(mature![0].argument).toMatchObject({
      effectCids: [],
      maturityDate: '2027-01-01',
    })
  })

  it('skips a swap not yet at maturity', async () => {
    const client = makeClient({
      swaps: [swap('swap-1', 'inst-1')],
      irsInstruments: [irsInstrument('inst-1', '2028-01-01')],
    })
    const r = await matureTick(client, now, setup)
    expect(r.fired).toBe(0)
    expect(r.skipped).toBe(1)
  })

  it('skips a swap with unsettled effects for its instrument', async () => {
    const client = makeClient({
      swaps: [swap('swap-1', 'inst-1')],
      irsInstruments: [irsInstrument('inst-1', '2027-01-01')],
      effects: [
        {
          contractId: 'eff-outstanding',
          payload: {
            targetInstrument: { id: { unpack: 'inst-1' } },
            eventTime: '2027-01-01T00:00:00Z',
          },
        },
      ],
    })
    const r = await matureTick(client, now, setup)
    expect(r.fired).toBe(0)
    expect(r.skipped).toBe(1)
  })

  it('treats an effect consumed by a NettedBatch as settled (not blocking maturity)', async () => {
    const client = makeClient({
      swaps: [swap('swap-1', 'inst-1')],
      irsInstruments: [irsInstrument('inst-1', '2027-01-01')],
      effects: [
        {
          contractId: 'eff-1',
          payload: {
            targetInstrument: { id: { unpack: 'inst-1' } },
            eventTime: '2027-01-01T00:00:00Z',
          },
        },
      ],
      batches: [{ contractId: 'batch-1', payload: { settledEffects: ['eff-1'] } }],
    })
    const r = await matureTick(client, now, setup)
    expect(r.fired).toBe(1)
  })

  it('skips an already-matured swap (MaturedSwap exists for instrument)', async () => {
    const client = makeClient({
      swaps: [swap('swap-1', 'inst-1')],
      irsInstruments: [irsInstrument('inst-1', '2027-01-01')],
      matured: [
        {
          contractId: 'ms-1',
          payload: { instrumentKey: { id: { unpack: 'inst-1' } } },
        },
      ],
    })
    const r = await matureTick(client, now, setup)
    expect(r.fired).toBe(0)
  })
})
