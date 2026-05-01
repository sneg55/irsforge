import { describe, expect, it, vi } from 'vitest'
import type { CurvePoint } from '../../providers/nyfed/types'
import { LedgerPublisher } from '../ledger-publisher'

const CURVE: CurvePoint[] = [
  { rateId: 'SOFR/ON', tenorDays: 1, rate: 0.053 },
  { rateId: 'SOFR/1M', tenorDays: 30, rate: 0.053 },
]

const FAKE_INTERFACE_ID = 'fake-pkg:Oracle.Interface:Provider'

function makeClient(
  overrides: Partial<{
    query: ReturnType<typeof vi.fn>
    exercise: ReturnType<typeof vi.fn>
  }> = {},
) {
  return {
    query: overrides.query ?? vi.fn().mockResolvedValue([]),
    exercise: overrides.exercise ?? vi.fn().mockResolvedValue({ exerciseResult: 'cid-1' }),
  }
}

describe('LedgerPublisher.publishCurve', () => {
  const PROVIDER_CID_RESULT = [{ contractId: 'provider-cid' }]

  it('publishes when no existing observation matches', async () => {
    const client = makeClient({
      query: vi
        .fn()
        .mockResolvedValueOnce([]) // idempotency check
        .mockResolvedValueOnce(PROVIDER_CID_RESULT), // provider lookup
    })
    const pub = new LedgerPublisher(client as never, FAKE_INTERFACE_ID)
    const result = await pub.publishCurve('2026-04-13', CURVE)
    expect(result).toEqual({ skipped: false, count: 2 })
    expect(client.exercise).toHaveBeenCalledTimes(1)
    const call = client.exercise.mock.calls[0][0]
    expect(call.choice).toBe('PublishCurve')
    expect(call.argument.args.effectiveDate).toBe('2026-04-13')
  })

  it('skips publish when observation already exists for (rateId, effectiveDate)', async () => {
    const client = makeClient({
      query: vi.fn().mockResolvedValueOnce([{ contractId: 'existing' }]),
    })
    const pub = new LedgerPublisher(client as never, FAKE_INTERFACE_ID)
    const result = await pub.publishCurve('2026-04-13', CURVE)
    expect(result).toEqual({ skipped: true, count: 0 })
    expect(client.exercise).not.toHaveBeenCalled()
  })

  it('surfaces errors from the idempotency query', async () => {
    const client = makeClient({
      query: vi.fn().mockRejectedValue(new Error('ledger down')),
    })
    const pub = new LedgerPublisher(client as never, FAKE_INTERFACE_ID)
    await expect(pub.publishCurve('2026-04-13', CURVE)).rejects.toThrow('ledger down')
  })

  it('surfaces errors from the exercise call', async () => {
    const client = makeClient({
      query: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(PROVIDER_CID_RESULT),
      exercise: vi.fn().mockRejectedValue(new Error('exercise failed')),
    })
    const pub = new LedgerPublisher(client as never, FAKE_INTERFACE_ID)
    await expect(pub.publishCurve('2026-04-13', CURVE)).rejects.toThrow('exercise failed')
  })

  it('throws when no NYFedOracleProvider contract exists', async () => {
    const client = makeClient({
      query: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
    })
    const pub = new LedgerPublisher(client as never, FAKE_INTERFACE_ID)
    await expect(pub.publishCurve('2026-04-13', CURVE)).rejects.toThrow(/NYFedOracleProvider/)
  })
})

describe('LedgerPublisher.publishDiscountCurve', () => {
  it('exercises PublishDiscountCurve with stringified pillar values and nyfed metadata', async () => {
    const client = makeClient({
      query: vi.fn().mockResolvedValueOnce([{ contractId: 'provider-cid' }]),
    })
    const pub = new LedgerPublisher(client as never, FAKE_INTERFACE_ID)
    await pub.publishDiscountCurve(
      'USD',
      '2026-04-20T00:00:00Z',
      [{ tenorDays: 1, zeroRate: 0.053 }],
      'LinearZero',
      'Act360',
    )
    const call = client.exercise.mock.calls[0][0]
    expect(call.choice).toBe('Provider_PublishDiscountCurve')
    expect(call.templateId).toBe(FAKE_INTERFACE_ID)
    expect(call.argument.currency).toBe('USD')
    expect(call.argument.pillars).toEqual([{ tenorDays: '1', zeroRate: '0.053' }])
    expect(JSON.parse(call.argument.constructionMetadata).source).toBe('nyfed')
  })
})

describe('LedgerPublisher.publishProjectionCurve', () => {
  it('exercises PublishProjectionCurve with the indexId argument', async () => {
    const client = makeClient({
      query: vi.fn().mockResolvedValueOnce([{ contractId: 'provider-cid' }]),
    })
    const pub = new LedgerPublisher(client as never, FAKE_INTERFACE_ID)
    await pub.publishProjectionCurve(
      'USD-SOFR',
      'USD',
      '2026-04-20T00:00:00Z',
      [{ tenorDays: 1, zeroRate: 0.053 }],
      'LinearZero',
      'Act360',
    )
    const call = client.exercise.mock.calls[0][0]
    expect(call.choice).toBe('Provider_PublishProjectionCurve')
    expect(call.templateId).toBe(FAKE_INTERFACE_ID)
    expect(call.argument.indexId).toBe('USD-SOFR')
  })
})

describe('LedgerPublisher.publishRate', () => {
  it('idempotency-checks and publishes when empty', async () => {
    const client = makeClient({
      query: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ contractId: 'provider-cid' }]),
    })
    const pub = new LedgerPublisher(client as never, FAKE_INTERFACE_ID)
    const result = await pub.publishRate({
      rateId: 'SOFR/INDEX',
      effectiveDate: '2026-04-13',
      value: 5.28,
    })
    expect(result.skipped).toBe(false)
    expect(client.exercise).toHaveBeenCalledTimes(1)
    expect(client.exercise.mock.calls[0][0].choice).toBe('Provider_PublishRate')
    expect(client.exercise.mock.calls[0][0].templateId).toBe(FAKE_INTERFACE_ID)
  })

  it('skips when observation already exists', async () => {
    const client = makeClient({
      query: vi.fn().mockResolvedValueOnce([{ contractId: 'existing' }]),
    })
    const pub = new LedgerPublisher(client as never, FAKE_INTERFACE_ID)
    const result = await pub.publishRate({
      rateId: 'SOFR/INDEX',
      effectiveDate: '2026-04-13',
      value: 5.28,
    })
    expect(result).toEqual({ skipped: true })
    expect(client.exercise).not.toHaveBeenCalled()
  })
})
