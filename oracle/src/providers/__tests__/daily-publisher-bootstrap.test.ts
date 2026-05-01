import type { Config } from 'irsforge-shared-config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IRSFORGE_PROVIDER_INTERFACE_ID } from '../../shared/generated/package-ids.js'
// Import the same pre-qualified IDs the source uses so the test tracks
// whatever the live scripts/gen-package-ids.sh produced for this build.
import {
  DAML_FINANCE_OBSERVATION_TEMPLATE_ID as DAML_FINANCE_OBSERVATION_TEMPLATE,
  DEMO_STUB_PROVIDER_TEMPLATE_ID as DEMO_STUB_PROVIDER_TEMPLATE,
  NYFED_PROVIDER_TEMPLATE_ID as NYFED_PROVIDER_TEMPLATE,
} from '../../shared/template-ids.js'
import { publishDailyWindowsForAllIndices } from '../daily-publisher-bootstrap.js'
import { buildDemoStubProvider } from '../demo-stub.js'
import { registerProvider } from '../registry.js'
import type { OracleProvider } from '../types.js'

const baseConfig = (): Config =>
  ({
    floatingRateIndices: {
      'USD-SOFR': {
        currency: 'USD',
        family: 'SOFR',
        compounding: 'CompoundedInArrears',
        lookback: 2,
        floor: 0,
      },
      'EUR-ESTR': {
        currency: 'EUR',
        family: 'ESTR',
        compounding: 'CompoundedInArrears',
        lookback: 0,
        floor: null,
      },
    },
    curves: {
      interpolation: 'LinearZero',
      currencies: {
        USD: {
          dayCount: 'Act360',
          discount: { provider: 'nyfed' },
          projection: { provider: 'nyfed', indexId: 'USD-SOFR' },
        },
        EUR: {
          dayCount: 'Act360',
          discount: { provider: 'demo-stub' },
          projection: { provider: 'demo-stub', indexId: 'EUR-ESTR' },
        },
      },
    },
    demo: {
      stubCurves: {
        EUR: {
          discount: { pillars: [{ tenorDays: 1, zeroRate: 0.0375 }] },
          projections: {
            'EUR-ESTR': { pillars: [{ tenorDays: 1, zeroRate: 0.039 }] },
          },
        },
      },
    },
  }) as unknown as Config

const silentLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

function makeNyFedProvider(opts: { rateSource?: (id: string, d: Date) => number }): OracleProvider {
  return {
    id: 'nyfed',
    supportedRateIds: ['USD-SOFR'],
    onchainInterfaceTemplateId: IRSFORGE_PROVIDER_INTERFACE_ID,
    async fetchRate(rateId, date) {
      return { rateId, effectiveDate: date, value: 0 }
    },
    rateSource: opts.rateSource,
  }
}

describe('publishDailyWindowsForAllIndices', () => {
  beforeEach(() => {
    silentLogger.info.mockClear()
    silentLogger.warn.mockClear()
    silentLogger.error.mockClear()
  })
  afterEach(() => {
    // Registry persists across tests by design; re-register fresh providers
    // per test case via beforeEach in the it block to keep behaviour pinned.
  })

  it('routes USD-SOFR through nyfed and EUR-ESTR through demo-stub via the interface template', async () => {
    registerProvider(makeNyFedProvider({ rateSource: () => 0.0532 }))
    registerProvider(buildDemoStubProvider(baseConfig()))

    const exercise = vi.fn().mockResolvedValue({ exerciseResult: 'obs-cid' })
    const query = vi.fn(async (template: string) => {
      if (template === NYFED_PROVIDER_TEMPLATE) return [{ contractId: 'nyfed-provider-cid' }]
      if (template === DEMO_STUB_PROVIDER_TEMPLATE)
        return [{ contractId: 'demo-stub-provider-cid' }]
      if (template === DAML_FINANCE_OBSERVATION_TEMPLATE) return []
      return []
    })
    const client = { query, exercise } as never

    await publishDailyWindowsForAllIndices({
      client,
      config: baseConfig(),
      logger: silentLogger,
      asOf: new Date('2026-04-16T00:00:00Z'),
      windowDays: 3,
    })

    // 3 days * 2 indices = 6 Provider_PublishRate exercises, all targeted
    // at the interface template id (registry dispatch).
    expect(exercise).toHaveBeenCalledTimes(6)
    for (const call of exercise.mock.calls) {
      const arg = call[0] as { templateId: string; choice: string }
      expect(arg.templateId).toBe(IRSFORGE_PROVIDER_INTERFACE_ID)
      expect(arg.choice).toBe('Provider_PublishRate')
    }

    const nyfedCalls = exercise.mock.calls.filter(
      (c) =>
        (c[0] as { argument: { args: { rateId: string } } }).argument.args.rateId === 'USD-SOFR',
    )
    const demoCalls = exercise.mock.calls.filter(
      (c) =>
        (c[0] as { argument: { args: { rateId: string } } }).argument.args.rateId === 'EUR-ESTR',
    )
    expect(nyfedCalls).toHaveLength(3)
    expect(demoCalls).toHaveLength(3)

    // Demo stub uses the projection pillar overnight rate from config.
    for (const call of demoCalls) {
      const arg = call[0] as { argument: { args: { value: string } } }
      expect(parseFloat(arg.argument.args.value)).toBe(0.039)
    }

    // Nyfed call uses the registered provider's rateSource closure.
    for (const call of nyfedCalls) {
      const arg = call[0] as { argument: { args: { value: string } } }
      expect(parseFloat(arg.argument.args.value)).toBe(0.0532)
    }
  })

  it('throws when the registered nyfed provider has no rateSource bootstrapped', async () => {
    // Re-register nyfed without a rateSource — mirrors the case where
    // bootstrapNyFedRateLookup hasn't run before publishDailyWindow.
    registerProvider(
      makeNyFedProvider({
        rateSource: () => {
          throw new Error('nyfedRateLookup not yet bootstrapped')
        },
      }),
    )
    registerProvider(buildDemoStubProvider(baseConfig()))

    const exercise = vi.fn().mockResolvedValue({ exerciseResult: 'obs-cid' })
    const query = vi.fn(async (template: string) => {
      if (template === NYFED_PROVIDER_TEMPLATE) return [{ contractId: 'nyfed-provider-cid' }]
      if (template === DEMO_STUB_PROVIDER_TEMPLATE)
        return [{ contractId: 'demo-stub-provider-cid' }]
      if (template === DAML_FINANCE_OBSERVATION_TEMPLATE) return []
      return []
    })
    const client = { query, exercise } as never

    await expect(
      publishDailyWindowsForAllIndices({
        client,
        config: baseConfig(),
        logger: silentLogger,
        asOf: new Date('2026-04-16T00:00:00Z'),
        windowDays: 3,
      }),
    ).rejects.toThrow(/nyfedRateLookup/)
  })

  it('does nothing when floatingRateIndices is absent', async () => {
    const exercise = vi.fn()
    const query = vi.fn(async () => [])
    const client = { query, exercise } as never

    await publishDailyWindowsForAllIndices({
      client,
      config: { curves: { currencies: {} } } as unknown as Config,
      logger: silentLogger,
    })

    expect(exercise).not.toHaveBeenCalled()
  })

  it('skips an index whose currency has no projection provider configured', async () => {
    const exercise = vi.fn()
    const query = vi.fn(async () => [])
    const client = { query, exercise } as never

    const cfg = {
      floatingRateIndices: {
        'JPY-TONA': {
          currency: 'JPY',
          family: 'TONA',
          compounding: 'CompoundedInArrears',
          lookback: 0,
          floor: null,
        },
      },
      curves: { interpolation: 'LinearZero', currencies: {} },
    } as unknown as Config

    await publishDailyWindowsForAllIndices({
      client,
      config: cfg,
      logger: silentLogger,
    })

    expect(exercise).not.toHaveBeenCalled()
  })

  it('skips dates already present on-chain (idempotency)', async () => {
    registerProvider(makeNyFedProvider({ rateSource: () => 0.0532 }))
    registerProvider(buildDemoStubProvider(baseConfig()))

    const exercise = vi.fn().mockResolvedValue({ exerciseResult: 'obs-cid' })
    const existingObservation = {
      payload: {
        // Daml Finance V4 Observation stores Map<Time, Decimal> as
        // [[ISO time, value], ...] over the JSON API.
        observations: [['2026-04-15T00:00:00Z', '0.05']],
      },
    }
    const query = vi.fn(async (template: string, filter?: unknown) => {
      if (template === NYFED_PROVIDER_TEMPLATE) return [{ contractId: 'nyfed-provider-cid' }]
      if (template === DEMO_STUB_PROVIDER_TEMPLATE)
        return [{ contractId: 'demo-stub-provider-cid' }]
      if (template === DAML_FINANCE_OBSERVATION_TEMPLATE) {
        const f = filter as { id?: { unpack?: string } } | undefined
        if (f?.id?.unpack === 'USD-SOFR') return [existingObservation]
        return []
      }
      return []
    })
    const client = { query, exercise } as never

    await publishDailyWindowsForAllIndices({
      client,
      config: baseConfig(),
      logger: silentLogger,
      asOf: new Date('2026-04-16T00:00:00Z'),
      windowDays: 2, // 2026-04-14 and 2026-04-15
    })

    const nyfedCalls = exercise.mock.calls.filter(
      (c) =>
        (c[0] as { argument: { args: { rateId: string } } }).argument.args.rateId === 'USD-SOFR',
    )
    // 2026-04-15 is already on-chain → only 1 nyfed publish (2026-04-14).
    expect(nyfedCalls).toHaveLength(1)
    const arg = nyfedCalls[0][0] as {
      argument: { args: { effectiveDate: string } }
    }
    expect(arg.argument.args.effectiveDate).toBe('2026-04-14')
  })
})
