import type { Config } from 'irsforge-shared-config'
import { describe, expect, it, vi } from 'vitest'
import type { LedgerClient } from '../../shared/ledger-client.js'
import type { Logger } from '../../shared/logger.js'
import type { State } from '../../shared/state.js'
import { DemoCurveTicker } from '../demo-curve-ticker.js'

const FAKE_PROVIDER_CID = 'provider-cid-1'

function makeLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

function makeClient(
  overrides: Partial<{
    query: ReturnType<typeof vi.fn>
    exercise: ReturnType<typeof vi.fn>
  }> = {},
) {
  return {
    query: overrides.query ?? vi.fn().mockResolvedValue([{ contractId: FAKE_PROVIDER_CID }]),
    exercise: overrides.exercise ?? vi.fn().mockResolvedValue({}),
  } as unknown as LedgerClient
}

// Minimal config fixture — just the fields DemoCurveTicker reads. Cast
// through `unknown` because the real Config carries fields we don't need
// to exercise the ticker.
function makeConfig(
  overrides: Partial<{
    tickerEnabled: boolean
    bpsRange: number
    includeProjection: boolean
  }> = {},
): Config {
  const tickerEnabled = overrides.tickerEnabled ?? true
  const bpsRange = overrides.bpsRange ?? 1
  const includeProjection = overrides.includeProjection ?? true

  return {
    curves: {
      interpolation: 'LinearZero',
      currencies: {
        USD: {
          dayCount: 'Act360',
          discount: { provider: 'demo-stub' },
          projection: includeProjection
            ? { provider: 'demo-stub', indexId: 'USD-SOFR' }
            : { provider: 'nyfed', indexId: 'USD-SOFR' },
        },
      },
    },
    demo: {
      stubCurves: {
        USD: {
          discount: {
            pillars: [
              { tenorDays: 1, zeroRate: 0.053 },
              { tenorDays: 365, zeroRate: 0.046 },
            ],
          },
          projections: {
            'USD-SOFR': {
              pillars: [
                { tenorDays: 1, zeroRate: 0.053 },
                { tenorDays: 365, zeroRate: 0.046 },
              ],
            },
          },
        },
      },
      curveTicker: {
        enabled: tickerEnabled,
        cron: '*/10 * * * * *',
        bpsRange,
      },
    },
  } as unknown as Config
}

describe('DemoCurveTicker.tick', () => {
  it('publishes discount + projection curves on each tick with perturbed pillars', async () => {
    const client = makeClient()
    const ticker = new DemoCurveTicker({
      client,
      config: makeConfig(),
      logger: makeLogger(),
      random: () => 1, // max positive perturbation, deterministic
      now: () => new Date('2026-04-20T10:00:00Z'),
    })

    const result = await ticker.tick()

    expect(result).toEqual({ published: 2, errors: 0 })
    const calls = (client.exercise as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[0][0].choice).toBe('Provider_PublishDiscountCurve')
    expect(calls[1][0].choice).toBe('Provider_PublishProjectionCurve')

    // Pillars perturbed by +1bp (random=1 → delta = (1*2-1) * 1 * 1e-4 = +1e-4).
    const discount = calls[0][0].argument
    expect(discount.currency).toBe('USD')
    expect(discount.asOf).toBe('2026-04-20T10:00:00.000Z')
    expect(discount.pillars).toEqual([
      { tenorDays: '1', zeroRate: '0.05310000' },
      { tenorDays: '365', zeroRate: '0.04610000' },
    ])

    // Projection carries the indexId.
    const projection = calls[1][0].argument
    expect(projection.indexId).toBe('USD-SOFR')
  })

  it('skips projection when its provider is not demo-stub', async () => {
    const client = makeClient()
    const ticker = new DemoCurveTicker({
      client,
      config: makeConfig({ includeProjection: false }),
      logger: makeLogger(),
      random: () => 0.5, // neutral midpoint
    })

    const result = await ticker.tick()

    expect(result).toEqual({ published: 1, errors: 0 })
    const calls = (client.exercise as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.map((c) => c[0].choice)).toEqual(['Provider_PublishDiscountCurve'])
  })

  it('no-ops when the ticker is disabled', async () => {
    const client = makeClient()
    const ticker = new DemoCurveTicker({
      client,
      config: makeConfig({ tickerEnabled: false }),
      logger: makeLogger(),
    })

    const result = await ticker.tick()

    expect(result).toEqual({ published: 0, errors: 0 })
    expect(client.exercise as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
  })

  it('records the perturbed USD overnight rate into state on each tick', async () => {
    const client = makeClient()
    const recordObservation = vi.fn()
    const recordOvernightRate = vi.fn()
    const state = { recordObservation, recordOvernightRate } as unknown as State
    const ticker = new DemoCurveTicker({
      client,
      config: makeConfig(),
      logger: makeLogger(),
      state,
      random: () => 1, // +1bp deterministic perturbation
      now: () => new Date('2026-04-20T10:00:00Z'),
    })

    await ticker.tick()

    // Projection pillar[0] = 0.053 + 1e-4 = 0.0531 (8dp).
    expect(recordObservation).toHaveBeenCalledTimes(1)
    expect(recordObservation).toHaveBeenCalledWith('USD-SOFR', '2026-04-19', 0.0531)
    expect(recordOvernightRate).toHaveBeenCalledTimes(1)
    const [effDate, percent] = recordOvernightRate.mock.calls[0]
    expect(effDate).toBe('2026-04-19')
    expect(percent).toBeCloseTo(5.31, 10)
  })

  it('does not touch state when no state dep is supplied', async () => {
    const client = makeClient()
    const ticker = new DemoCurveTicker({
      client,
      config: makeConfig(),
      logger: makeLogger(),
      random: () => 0.5,
    })

    const result = await ticker.tick()

    expect(result.published).toBe(2)
    // No throw = passes. (Negative assertion here would need a spy, but
    // the absence of the `state` dep guarantees recordOvernightState bails
    // before touching anything.)
  })

  it('start() registers a cron job and stop() clears it (noops when disabled)', () => {
    const enabled = new DemoCurveTicker({
      client: makeClient(),
      config: makeConfig(),
      logger: makeLogger(),
    })
    enabled.start()
    // Sanity: a second stop() after start() must not throw.
    enabled.stop()
    enabled.stop()

    const disabled = new DemoCurveTicker({
      client: makeClient(),
      config: makeConfig({ tickerEnabled: false }),
      logger: makeLogger(),
    })
    disabled.start() // Should no-op because ticker.enabled === false.
    disabled.stop()
  })

  it('counts an error when an exercise call fails but keeps publishing the rest', async () => {
    const client = makeClient({
      exercise: vi.fn().mockRejectedValueOnce(new Error('sandbox down')).mockResolvedValueOnce({}),
    })
    const ticker = new DemoCurveTicker({
      client,
      config: makeConfig(),
      logger: makeLogger(),
      random: () => 0.5,
    })

    const result = await ticker.tick()

    expect(result).toEqual({ published: 1, errors: 1 })
    expect(client.exercise as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(2)
  })
})
