import { describe, expect, it, vi } from 'vitest'
import type { LedgerClient } from '@/shared/ledger/client'
import {
  acknowledgeDispute,
  agreeToCounterMark,
  dispute,
  escalateDispute,
  exerciseCsaWithRetry,
  makeCsaPairResolver,
  postCollateral,
  withdrawExcess,
} from '../csa-actions'

function makeClient(exerciseResult: unknown): {
  client: LedgerClient
  exercise: ReturnType<typeof vi.fn>
} {
  const exercise = vi.fn(async () => ({ result: { exerciseResult } }))
  return { client: { exercise } as unknown as LedgerClient, exercise }
}

describe('postCollateral', () => {
  it('calls exercise with PostCollateral and stringified amount, returns new cid', async () => {
    const { client, exercise } = makeClient('newCsaCid')
    const out = await postCollateral(client, 'csa1', 'PA', 'USD', 1_000_000)
    expect(out).toBe('newCsaCid')
    expect(exercise).toHaveBeenCalledWith(
      expect.stringContaining('Csa.Csa:Csa'),
      'csa1',
      'PostCollateral',
      { poster: 'PA', ccy: 'USD', amount: '1000000' },
    )
  })

  it('throws when exerciseResult is missing', async () => {
    const { client } = makeClient(undefined)
    await expect(postCollateral(client, 'csa1', 'PA', 'USD', 1)).rejects.toThrow(/exerciseResult/)
  })
})

describe('withdrawExcess', () => {
  it('calls exercise with WithdrawExcess', async () => {
    const { client, exercise } = makeClient('csa2')
    const out = await withdrawExcess(client, 'csa1', 'PA', 'USD', 500_000)
    expect(out).toBe('csa2')
    expect(exercise).toHaveBeenCalledWith(
      expect.stringContaining('Csa.Csa:Csa'),
      'csa1',
      'WithdrawExcess',
      { withdrawer: 'PA', ccy: 'USD', amount: '500000' },
    )
  })
})

describe('dispute', () => {
  it('exercises Dispute with stringified counter-mark, reason enum, and notes', async () => {
    const { client, exercise } = makeClient('csa3')
    const out = await dispute(client, 'csa1', 'PA', 800_000, 'Valuation', 'off by 200k')
    expect(out).toBe('csa3')
    expect(exercise).toHaveBeenCalledWith(
      expect.stringContaining('Csa.Csa:Csa'),
      'csa1',
      'Dispute',
      { disputer: 'PA', counterMark: '800000', reason: 'Valuation', notes: 'off by 200k' },
    )
  })
})

describe('escalateDispute', () => {
  it('exercises EscalateDispute with the escalator party', async () => {
    const { client, exercise } = makeClient('csa-esc')
    const out = await escalateDispute(client, 'csa1', 'PB')
    expect(out).toBe('csa-esc')
    expect(exercise).toHaveBeenCalledWith(
      expect.stringContaining('Csa.Csa:Csa'),
      'csa1',
      'EscalateDispute',
      { escalator: 'PB' },
    )
  })
})

describe('agreeToCounterMark', () => {
  it('exercises AgreeToCounterMark with agreer + fresh-mark args', async () => {
    const { client, exercise } = makeClient('csa-agreed')
    const out = await agreeToCounterMark(
      client,
      'csa1',
      'PB',
      '2026-04-17T13:00:00Z',
      '{"curveCids":["c1"]}',
    )
    expect(out).toBe('csa-agreed')
    expect(exercise).toHaveBeenCalledWith(
      expect.stringContaining('Csa.Csa:Csa'),
      'csa1',
      'AgreeToCounterMark',
      { agreer: 'PB', asOf: '2026-04-17T13:00:00Z', snapshot: '{"curveCids":["c1"]}' },
    )
  })
})

describe('acknowledgeDispute', () => {
  it('exercises AcknowledgeDispute with fresh-mark args', async () => {
    const { client, exercise } = makeClient('csa4')
    const out = await acknowledgeDispute(
      client,
      'csa1',
      '2026-04-17T13:00:00Z',
      850_000,
      '{"curveCids":["c1"]}',
    )
    expect(out).toBe('csa4')
    expect(exercise).toHaveBeenCalledWith(
      expect.stringContaining('Csa.Csa:Csa'),
      'csa1',
      'AcknowledgeDispute',
      {
        newAsOf: '2026-04-17T13:00:00Z',
        newExposure: '850000',
        newSnapshot: '{"curveCids":["c1"]}',
      },
    )
  })
})

describe('exerciseCsaWithRetry', () => {
  it('passes through on success', async () => {
    const exercise = vi.fn(async () => ({ result: { exerciseResult: 'ok' } }))
    const client = { exercise } as unknown as LedgerClient
    const resolve = vi.fn(async () => 'fresh-cid')
    const out = await exerciseCsaWithRetry(
      client,
      'initial-cid',
      'PostCollateral',
      { poster: 'PA', ccy: 'USD', amount: '1' },
      resolve,
    )
    expect(out).toEqual({ result: { exerciseResult: 'ok' } })
    expect(exercise).toHaveBeenCalledTimes(1)
    expect(resolve).not.toHaveBeenCalled()
  })

  it('retries on CONTRACT_NOT_FOUND, re-resolves fresh cid, and succeeds', async () => {
    // Archive race: first attempt hits the stale cid; resolver returns the
    // post-tick cid and the second attempt succeeds.
    const exercise = vi
      .fn()
      .mockRejectedValueOnce(
        new Error('Ledger API error (404): {"errors":["NOT_FOUND: CONTRACT_NOT_FOUND ..."]}'),
      )
      .mockResolvedValueOnce({ result: { exerciseResult: 'ok' } })
    const client = { exercise } as unknown as LedgerClient
    const resolve = vi.fn(async () => 'fresh-cid')
    const out = await exerciseCsaWithRetry(
      client,
      'stale-cid',
      'PostCollateral',
      { poster: 'PA', ccy: 'USD', amount: '1' },
      resolve,
    )
    expect(out).toEqual({ result: { exerciseResult: 'ok' } })
    expect(exercise).toHaveBeenCalledTimes(2)
    expect(exercise.mock.calls[0]?.[1]).toBe('stale-cid')
    expect(exercise.mock.calls[1]?.[1]).toBe('fresh-cid')
  })

  it('propagates non-contention errors immediately (no retry)', async () => {
    const exercise = vi.fn().mockRejectedValue(new Error('500: some other failure'))
    const client = { exercise } as unknown as LedgerClient
    const resolve = vi.fn(async () => 'fresh-cid')
    await expect(
      exerciseCsaWithRetry(
        client,
        'cid',
        'PostCollateral',
        { poster: 'PA', ccy: 'USD', amount: '1' },
        resolve,
      ),
    ).rejects.toThrow('500: some other failure')
    expect(exercise).toHaveBeenCalledTimes(1)
    expect(resolve).not.toHaveBeenCalled()
  })

  it('surfaces the original contention error when the pair can no longer be resolved', async () => {
    const exercise = vi
      .fn()
      .mockRejectedValue(new Error('Ledger API error (404): CONTRACT_NOT_FOUND'))
    const client = { exercise } as unknown as LedgerClient
    const resolve = vi.fn(async () => null)
    await expect(
      exerciseCsaWithRetry(
        client,
        'cid',
        'PostCollateral',
        { poster: 'PA', ccy: 'USD', amount: '1' },
        resolve,
      ),
    ).rejects.toThrow(/CONTRACT_NOT_FOUND/)
    // One exercise attempt, one resolver attempt, then surface.
    expect(exercise).toHaveBeenCalledTimes(1)
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it('gives up after the attempt budget even if contention persists', async () => {
    const exercise = vi
      .fn()
      .mockRejectedValue(new Error('Ledger API error (404): CONTRACT_NOT_FOUND'))
    const client = { exercise } as unknown as LedgerClient
    const resolve = vi.fn(async () => 'different-cid')
    await expect(
      exerciseCsaWithRetry(
        client,
        'cid',
        'PostCollateral',
        { poster: 'PA', ccy: 'USD', amount: '1' },
        resolve,
        3,
      ),
    ).rejects.toThrow(/CONTRACT_NOT_FOUND/)
    expect(exercise).toHaveBeenCalledTimes(3)
  })

  it('does not retry when no resolver is passed (back-compat)', async () => {
    const exercise = vi
      .fn()
      .mockRejectedValue(new Error('Ledger API error (404): CONTRACT_NOT_FOUND'))
    const client = { exercise } as unknown as LedgerClient
    await expect(
      exerciseCsaWithRetry(client, 'cid', 'PostCollateral', {
        poster: 'PA',
        ccy: 'USD',
        amount: '1',
      }),
    ).rejects.toThrow(/CONTRACT_NOT_FOUND/)
    expect(exercise).toHaveBeenCalledTimes(1)
  })
})

describe('makeCsaPairResolver', () => {
  it('returns the cid of the CSA whose payload matches the pair', async () => {
    const query = vi.fn().mockResolvedValue([
      { contractId: 'cid-x', payload: { partyA: 'PA', partyB: 'OTHER' } },
      { contractId: 'cid-y', payload: { partyA: 'PA', partyB: 'PB' } },
      { contractId: 'cid-z', payload: { partyA: 'PB', partyB: 'PA' } },
    ])
    const client = { query } as unknown as LedgerClient
    const resolve = makeCsaPairResolver(client, 'PA', 'PB')
    expect(await resolve()).toBe('cid-y')
  })

  it('returns null when no CSA for the pair exists (e.g. archived + not yet re-created)', async () => {
    const query = vi.fn().mockResolvedValue([])
    const client = { query } as unknown as LedgerClient
    const resolve = makeCsaPairResolver(client, 'PA', 'PB')
    expect(await resolve()).toBeNull()
  })
})
