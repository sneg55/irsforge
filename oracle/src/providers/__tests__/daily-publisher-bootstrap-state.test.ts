import type { Config } from 'irsforge-shared-config'
import { describe, expect, it, vi } from 'vitest'
import type { State } from '../../shared/state.js'
import {
  DAML_FINANCE_OBSERVATION_TEMPLATE_ID as DAML_FINANCE_OBSERVATION_TEMPLATE,
  DEMO_STUB_PROVIDER_TEMPLATE_ID as DEMO_STUB_PROVIDER_TEMPLATE,
} from '../../shared/template-ids.js'
import { publishDailyWindowsForAllIndices } from '../daily-publisher-bootstrap.js'
import { buildDemoStubProvider } from '../demo-stub.js'
import { registerProvider } from '../registry.js'

const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

const demoUsdConfig: Config = {
  floatingRateIndices: {
    'USD-SOFR': {
      currency: 'USD',
      family: 'SOFR',
      compounding: 'CompoundedInArrears',
      lookback: 2,
      floor: 0,
    },
  },
  curves: {
    interpolation: 'LinearZero',
    currencies: {
      USD: {
        dayCount: 'Act360',
        discount: { provider: 'demo-stub' },
        projection: { provider: 'demo-stub', indexId: 'USD-SOFR' },
      },
    },
  },
  demo: {
    stubCurves: {
      USD: {
        discount: { pillars: [{ tenorDays: 1, zeroRate: 0.052 }] },
        projections: {
          'USD-SOFR': { pillars: [{ tenorDays: 1, zeroRate: 0.0535 }] },
        },
      },
    },
  },
} as unknown as Config

describe('publishDailyWindowsForAllIndices state recording', () => {
  it('records the USD projection overnight rate after demo-stub back-fill', async () => {
    registerProvider(buildDemoStubProvider(demoUsdConfig))

    const exercise = vi.fn().mockResolvedValue({ exerciseResult: 'obs-cid' })
    const query = vi.fn(async (template: string) => {
      if (template === DEMO_STUB_PROVIDER_TEMPLATE)
        return [{ contractId: 'demo-stub-provider-cid' }]
      if (template === DAML_FINANCE_OBSERVATION_TEMPLATE) return []
      return []
    })
    const client = { query, exercise } as never

    const recordOvernightRate = vi.fn()
    const recordObservation = vi.fn()
    const state = { recordOvernightRate, recordObservation } as unknown as State

    await publishDailyWindowsForAllIndices({
      client,
      config: demoUsdConfig,
      logger: silentLogger,
      asOf: new Date('2026-04-16T00:00:00Z'),
      windowDays: 2,
      state,
    })

    expect(recordOvernightRate).toHaveBeenCalledWith('2026-04-15', 5.35)
    expect(recordObservation).toHaveBeenCalledWith('USD-SOFR', '2026-04-15', 0.0535)
  })

  it('no-ops state when config has no USD projection index (state stays untouched)', async () => {
    const cfg = {
      ...demoUsdConfig,
      curves: {
        interpolation: 'LinearZero',
        currencies: {
          EUR: {
            dayCount: 'Act360',
            discount: { provider: 'demo-stub' },
            projection: { provider: 'demo-stub', indexId: 'EUR-ESTR' },
          },
        },
      },
      floatingRateIndices: {
        'EUR-ESTR': {
          currency: 'EUR',
          family: 'ESTR',
          compounding: 'CompoundedInArrears',
          lookback: 0,
          floor: null,
        },
      },
      demo: {
        stubCurves: {
          EUR: {
            discount: { pillars: [{ tenorDays: 1, zeroRate: 0.03 }] },
            projections: {
              'EUR-ESTR': { pillars: [{ tenorDays: 1, zeroRate: 0.031 }] },
            },
          },
        },
      },
    } as unknown as Config

    registerProvider(buildDemoStubProvider(cfg))

    const exercise = vi.fn().mockResolvedValue({ exerciseResult: 'obs-cid' })
    const query = vi.fn(async (template: string) => {
      if (template === DEMO_STUB_PROVIDER_TEMPLATE)
        return [{ contractId: 'demo-stub-provider-cid' }]
      return []
    })
    const client = { query, exercise } as never

    const recordOvernightRate = vi.fn()
    const recordObservation = vi.fn()
    const state = { recordOvernightRate, recordObservation } as unknown as State

    await publishDailyWindowsForAllIndices({
      client,
      config: cfg,
      logger: silentLogger,
      asOf: new Date('2026-04-16T00:00:00Z'),
      windowDays: 1,
      state,
    })

    expect(recordOvernightRate).not.toHaveBeenCalled()
  })
})
