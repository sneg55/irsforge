import { describe, expect, it, vi } from 'vitest'
import type { DecodedCsa } from '../decode.js'
import { CsaPublisher } from '../publisher.js'

const mkClient = () => {
  const exercise = vi.fn(async (cmd: { choice: string }) => {
    if (cmd.choice === 'PublishMark') {
      // Canton JSON API shape: exerciseResult is a tuple record { _1, _2 }
      // wrapped in { result: { ..., exerciseResult }, status }. The mock
      // mirrors that envelope so production destructuring works untouched.
      return {
        result: {
          exerciseResult: { _1: 'csaCid_after_publish', _2: 'markCid_1' },
          events: [],
        },
        status: 200,
      }
    }
    return { result: { exerciseResult: null, events: [] }, status: 200 }
  })
  return {
    client: { exercise, create: vi.fn(), query: vi.fn() } as never,
    exercise,
  }
}

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

const baseCsa = (overrides: Partial<DecodedCsa> = {}): DecodedCsa => ({
  contractId: 'csa1',
  operator: 'Op',
  partyA: 'PA',
  partyB: 'PB',
  regulators: ['Reg'],
  thresholdDirA: 0,
  thresholdDirB: 0,
  mta: 100_000,
  rounding: 10_000,
  valuationCcy: 'USD',
  postedByA: new Map([['USD', 5_000_000]]),
  postedByB: new Map([['USD', 5_000_000]]),
  state: 'Active',
  lastMarkCid: null,
  isdaMasterAgreementRef: '',
  governingLaw: 'NewYork',
  imAmount: 0,
  ...overrides,
})

describe('CsaPublisher', () => {
  it('publishes + settles when call > MTA and state Active', async () => {
    const { client, exercise } = mkClient()
    const p = new CsaPublisher(client, logger)
    const out = await p.publishAndMaybeSettle(
      baseCsa(),
      { exposure: 1_000_000, asOf: '2026-04-17T12:00:00Z', swapPvs: [] },
      '{}',
    )
    expect(exercise).toHaveBeenCalledTimes(2)
    expect(out.settled).toBe(true)
    expect(out.markCid).toBe('markCid_1')
  })

  it('publishes only (no settle) when |call| < MTA', async () => {
    const { client, exercise } = mkClient()
    const p = new CsaPublisher(client, logger)
    const out = await p.publishAndMaybeSettle(
      baseCsa(),
      { exposure: 50_000, asOf: '2026-04-17T12:00:00Z', swapPvs: [] },
      '{}',
    )
    expect(exercise).toHaveBeenCalledTimes(1)
    expect(out.settled).toBe(false)
  })

  it('publishes only when state == MarkDisputed', async () => {
    const { client, exercise } = mkClient()
    const p = new CsaPublisher(client, logger)
    const out = await p.publishAndMaybeSettle(
      baseCsa({ state: 'MarkDisputed' }),
      { exposure: 5_000_000, asOf: '2026-04-17T12:00:00Z', swapPvs: [] },
      '{}',
    )
    expect(exercise).toHaveBeenCalledTimes(1)
    expect(out.settled).toBe(false)
  })

  it('publishes only when state == Escalated', async () => {
    // Escalated CSAs are post-Dispute, awaiting an operator-signed
    // `AcknowledgeDispute`. The publisher records the fresh mark for
    // audit but must not chain SettleVm (the choice itself rejects the
    // call ledger-side, but skipping client-side avoids a guaranteed
    // 400 on every tick).
    const { client, exercise } = mkClient()
    const p = new CsaPublisher(client, logger)
    const out = await p.publishAndMaybeSettle(
      baseCsa({ state: 'Escalated' }),
      { exposure: 5_000_000, asOf: '2026-04-17T12:00:00Z', swapPvs: [] },
      '{}',
    )
    expect(exercise).toHaveBeenCalledTimes(1)
    expect(out.settled).toBe(false)
  })

  it('still calls SettleVm while state == MarginCallOutstanding so the contract can clear the trap state', async () => {
    // Regression for the "Call Out trap": the publisher previously gated
    // on state == Active, which combined with the contract-side gate left
    // MarginCallOutstanding pinned forever. Now both sides accept
    // MarginCallOutstanding; the CSA clears itself on the next flat mark.
    const { client, exercise } = mkClient()
    const p = new CsaPublisher(client, logger)
    const out = await p.publishAndMaybeSettle(
      baseCsa({ state: 'MarginCallOutstanding' }),
      { exposure: 0, asOf: '2026-04-17T14:00:00Z', swapPvs: [] },
      '{}',
    )
    expect(exercise).toHaveBeenCalledTimes(2)
    expect(out.settled).toBe(true)
  })

  it('skips SettleVm for a flat mark while state is already Active', async () => {
    const { client, exercise } = mkClient()
    const p = new CsaPublisher(client, logger)
    const out = await p.publishAndMaybeSettle(
      baseCsa({ state: 'Active' }),
      { exposure: 50_000, asOf: '2026-04-17T12:00:00Z', swapPvs: [] },
      '{}',
    )
    expect(exercise).toHaveBeenCalledTimes(1)
    expect(out.settled).toBe(false)
  })
})
