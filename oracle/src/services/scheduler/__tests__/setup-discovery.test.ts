import { describe, expect, it, vi } from 'vitest'
import type { LedgerClient } from '../../../shared/ledger-client.js'
import { discoverSetup } from '../setup-discovery.js'

const makeClient = (rows: unknown[]): LedgerClient =>
  ({
    query: vi.fn().mockResolvedValue(rows),
  }) as unknown as LedgerClient

describe('discoverSetup', () => {
  const usdKey = {
    depository: 'Op',
    issuer: 'Op',
    id: { unpack: 'USD' },
    version: '0',
    holdingStandard: 'TransferableFungible',
  }
  const accountA = { custodian: 'Op', owner: 'A', id: { unpack: 'acct-A' } }
  const accountB = { custodian: 'Op', owner: 'B', id: { unpack: 'acct-B' } }

  const fullPayload = {
    schedulerLifecycleRuleCid: 'rule-sched-1',
    lifecycleRuleCid: 'rule-op-1',
    settlementFactoryCid: 'fac-1',
    routeProviderCid: 'route-1',
    eventFactoryCid: 'eventfac-1',
    defaultCurrencyCode: 'USD',
    currencies: [['USD', usdKey]],
    partyAAccountKey: accountA,
    partyBAccountKey: accountB,
  }

  it('extracts scheduler rule + factories + default-ccy key + account keys from CashSetupRecord', async () => {
    const client = makeClient([{ contractId: 'csr-1', payload: fullPayload }])
    const setup = await discoverSetup(client)
    expect(setup).toEqual({
      schedulerLifecycleRuleCid: 'rule-sched-1',
      settlementFactoryCid: 'fac-1',
      routeProviderCid: 'route-1',
      eventFactoryCid: 'eventfac-1',
      defaultCurrencyInstrumentKey: usdKey,
      partyAAccountKey: accountA,
      partyBAccountKey: accountB,
    })
  })

  it('throws loudly if no CashSetupRecord found', async () => {
    const client = makeClient([])
    await expect(discoverSetup(client)).rejects.toThrow(/CashSetupRecord/)
  })

  it('throws loudly if schedulerLifecycleRuleCid is missing (pre-C1 ledger)', async () => {
    const { schedulerLifecycleRuleCid: _discard, ...rest } = fullPayload
    const client = makeClient([{ contractId: 'csr-1', payload: rest }])
    await expect(discoverSetup(client)).rejects.toThrow(/schedulerLifecycleRuleCid/)
  })

  it('throws if defaultCurrencyCode not in currencies', async () => {
    const client = makeClient([
      {
        contractId: 'csr-1',
        payload: { ...fullPayload, defaultCurrencyCode: 'XYZ' },
      },
    ])
    await expect(discoverSetup(client)).rejects.toThrow(/XYZ/)
  })
})
