import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LedgerClient } from '../../../shared/ledger-client.js'
import {
  CSA_TEMPLATE_ID,
  DAML_FINANCE_EFFECT_TEMPLATE_ID,
  NETTED_BATCH_TEMPLATE_ID,
  SWAP_WORKFLOW_TEMPLATE_ID,
  TRANSFERABLE_FUNGIBLE_TEMPLATE_ID,
} from '../../../shared/template-ids.js'
import { settleNetTick } from '../settle-net.js'

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

const instrKey = (id: string) => ({
  depository: 'Op',
  issuer: 'Op',
  id: { unpack: id },
  version: '0',
  holdingStandard: 'TransferableFungible',
})

const acct = (owner: string, ccy: string) => ({
  custodian: 'Op',
  owner,
  id: { unpack: `account-${owner}-${ccy}` },
})

const csa = (cid: string, a = 'A', b = 'B') => ({
  contractId: cid,
  payload: { partyA: a, partyB: b, valuationCcy: 'USD' },
})

const swap = (cid: string, instId: string, a = 'A', b = 'B') => ({
  contractId: cid,
  payload: {
    partyA: a,
    partyB: b,
    operator: 'Op',
    regulators: ['R'],
    scheduler: 'Sch',
    swapType: 'IRS',
    instrumentKey: instrKey(instId),
    notional: '1000000',
  },
})

const effect = (cid: string, instId: string, ts: string) => ({
  contractId: cid,
  payload: {
    targetInstrument: { id: { unpack: instId } },
    eventTime: ts,
  },
})

const holding = (cid: string, owner: string, ccy: string, amount: string) => ({
  contractId: cid,
  payload: {
    instrument: instrKey(ccy),
    account: acct(owner, ccy),
    amount,
  },
})

interface Mocks {
  csas?: unknown[]
  swaps?: unknown[]
  effects?: unknown[]
  batches?: unknown[]
  holdings?: unknown[]
}

function makeClient(m: Mocks): LedgerClient {
  const query = vi.fn(async (templateId: string) => {
    if (templateId === CSA_TEMPLATE_ID) return m.csas ?? []
    if (templateId === SWAP_WORKFLOW_TEMPLATE_ID) return m.swaps ?? []
    if (templateId === DAML_FINANCE_EFFECT_TEMPLATE_ID) return m.effects ?? []
    if (templateId === NETTED_BATCH_TEMPLATE_ID) return m.batches ?? []
    if (templateId === TRANSFERABLE_FUNGIBLE_TEMPLATE_ID) return m.holdings ?? []
    return []
  })
  const exercise = vi.fn(async () => ({
    result: { exerciseResult: 'new-batch-cid' },
  }))
  return { query, exercise } as unknown as LedgerClient
}

describe('settleNetTick', () => {
  let now: Date
  beforeEach(() => {
    now = new Date('2026-04-19T12:00:00Z')
  })

  it('groups two effects on same (CSA, ts) into a single SettleNetByScheduler call', async () => {
    const ts = '2026-04-18T00:00:00Z'
    const client = makeClient({
      csas: [csa('csa-1')],
      swaps: [swap('swap-1', 'inst-1'), swap('swap-2', 'inst-2')],
      effects: [effect('eff-1', 'inst-1', ts), effect('eff-2', 'inst-2', ts)],
      holdings: [
        holding('h-a-usd', 'A', 'USD', '1000000'),
        holding('h-b-usd', 'B', 'USD', '1000000'),
      ],
    })
    const r = await settleNetTick(client, now, setup)
    expect(r.fired).toBe(1)
    const calls = (client.exercise as unknown as ReturnType<typeof vi.fn>).mock.calls
    const settle = calls.filter((c) => c[0].choice === 'SettleNetByScheduler')
    expect(settle.length).toBe(1)
    expect(settle[0][0].argument.entries.length).toBe(2)
    expect(settle[0][0].argument.paymentTimestamp).toBe(ts)
  })

  it('splits effects on different timestamps into separate SettleNetByScheduler calls', async () => {
    const client = makeClient({
      csas: [csa('csa-1')],
      swaps: [swap('swap-1', 'inst-1')],
      effects: [
        effect('eff-1', 'inst-1', '2026-04-15T00:00:00Z'),
        effect('eff-2', 'inst-1', '2026-04-18T00:00:00Z'),
      ],
      holdings: [holding('h-a', 'A', 'USD', '1000000'), holding('h-b', 'B', 'USD', '1000000')],
    })
    const r = await settleNetTick(client, now, setup)
    expect(r.fired).toBe(2)
  })

  it('skips an Effect already referenced in NettedBatch.settledEffects', async () => {
    const ts = '2026-04-18T00:00:00Z'
    const client = makeClient({
      csas: [csa('csa-1')],
      swaps: [swap('swap-1', 'inst-1')],
      effects: [effect('eff-1', 'inst-1', ts)],
      batches: [{ contractId: 'batch-1', payload: { settledEffects: ['eff-1'] } }],
      holdings: [holding('h-a', 'A', 'USD', '1000000'), holding('h-b', 'B', 'USD', '1000000')],
    })
    const r = await settleNetTick(client, now, setup)
    expect(r.fired).toBe(0)
    expect(r.skipped).toBeGreaterThan(0)
  })

  it('skips a CSA whose netting set has no unsettled effects', async () => {
    const client = makeClient({
      csas: [csa('csa-1')],
      swaps: [swap('swap-1', 'inst-1')],
      effects: [],
    })
    const r = await settleNetTick(client, now, setup)
    expect(r.fired).toBe(0)
    expect(r.skipped).toBe(1)
  })

  it('collects per-CSA errors, continues with other CSAs', async () => {
    const ts = '2026-04-18T00:00:00Z'
    const client = makeClient({
      csas: [csa('csa-bad'), csa('csa-ok', 'C', 'D')],
      swaps: [swap('swap-bad', 'inst-bad'), swap('swap-ok', 'inst-ok', 'C', 'D')],
      effects: [effect('eff-bad', 'inst-bad', ts), effect('eff-ok', 'inst-ok', ts)],
      holdings: [
        holding('h-a', 'A', 'USD', '1'),
        holding('h-b', 'B', 'USD', '1'),
        holding('h-c', 'C', 'USD', '1'),
        holding('h-d', 'D', 'USD', '1'),
      ],
    })
    ;(client.exercise as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (cmd: { contractId: string }) => {
        if (cmd.contractId === 'csa-bad') throw new Error('boom')
        return { result: { exerciseResult: 'ok' } }
      },
    )
    const r = await settleNetTick(client, now, setup)
    expect(r.fired).toBe(1)
    expect(r.errors.length).toBe(1)
  })
})
