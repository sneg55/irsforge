import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LedgerClient } from '../../../shared/ledger-client.js'
import { SchedulerService } from '../index.js'

describe('SchedulerService', () => {
  let svc: SchedulerService
  let client: LedgerClient

  beforeEach(() => {
    client = {
      query: vi.fn().mockResolvedValue([]),
      exercise: vi.fn(),
    } as unknown as LedgerClient
    svc = new SchedulerService(
      client,
      {
        cron: {
          trigger: '*/5 * * * * *',
          settleNet: '*/5 * * * * *',
          mature: '*/30 * * * * *',
        },
      },
      {
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
      },
    )
  })

  it('triggerTick returns a TickResult shape', async () => {
    const r = await svc.triggerTick()
    expect(r).toEqual({ fired: 0, skipped: 0, errors: [] })
  })
  it('settleNetTick returns a TickResult shape', async () => {
    const r = await svc.settleNetTick()
    expect(r).toEqual({ fired: 0, skipped: 0, errors: [] })
  })
  it('matureTick returns a TickResult shape', async () => {
    const r = await svc.matureTick()
    expect(r).toEqual({ fired: 0, skipped: 0, errors: [] })
  })

  it('start() returns three croner instances that caller can stop', async () => {
    const crons = svc.start()
    expect(crons.length).toBe(3)
    crons.forEach((c) => c.stop())
  })
})
