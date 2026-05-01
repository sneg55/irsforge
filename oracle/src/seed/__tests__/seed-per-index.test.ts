import { describe, expect, it, vi } from 'vitest'
import { buildDemoStubProvider } from '../../providers/demo-stub.js'
import { registerProvider } from '../../providers/registry.js'
import { IRSFORGE_PROVIDER_INTERFACE_ID } from '../../shared/generated/package-ids.js'
import { seedCurves } from '../index.js'

// publishCurveViaProvider does:
//   1. getConcreteTemplateId(providerId) → concrete template id
//   2. client.query(concreteTemplate) → returns [{contractId}]
//   3. exerciseProviderChoice → client.exercise({templateId: interface, ...})
//
// We mock query to return a single provider stub so the publish path is
// taken; exercise captures every Provider_* invocation. The registry
// must be primed with the demo-stub provider so getProvider succeeds.
describe('seedCurves iterates per-index projections', () => {
  it('publishes one Projection contract per (ccy, indexId) via the interface template', async () => {
    const exercise = vi.fn().mockResolvedValue(undefined)
    const query = vi.fn().mockResolvedValue([{ contractId: 'provider-cid-1' }])

    const client = { query, exercise, create: vi.fn() }

    const config = {
      curves: {
        interpolation: 'LinearZero',
        currencies: {
          USD: {
            dayCount: 'Act360',
            discount: { provider: 'demo-stub' },
            projection: { indexId: 'USD-SOFR', provider: 'demo-stub' },
          },
        },
      },
      demo: {
        stubCurves: {
          USD: {
            discount: {
              pillars: [
                { tenorDays: 1, zeroRate: 0.05 },
                { tenorDays: 365, zeroRate: 0.04 },
              ],
            },
            projections: {
              'USD-SOFR': {
                pillars: [
                  { tenorDays: 1, zeroRate: 0.05 },
                  { tenorDays: 365, zeroRate: 0.04 },
                ],
              },
              'USD-EFFR': {
                pillars: [
                  { tenorDays: 1, zeroRate: 0.0505 },
                  { tenorDays: 365, zeroRate: 0.04 },
                ],
              },
            },
          },
        },
      },
      floatingRateIndices: {},
    } as never

    registerProvider(buildDemoStubProvider(config))

    await seedCurves(client as never, config)

    const projCalls = exercise.mock.calls.filter(
      (c) => (c[0] as { choice: string }).choice === 'Provider_PublishProjectionCurve',
    )
    expect(projCalls).toHaveLength(2)
    for (const call of projCalls) {
      const arg = call[0] as { templateId: string }
      expect(arg.templateId).toBe(IRSFORGE_PROVIDER_INTERFACE_ID)
    }

    const indexIds = projCalls.map(
      (c) => (c[0] as { argument: { indexId: string } }).argument.indexId,
    )
    expect(indexIds).toContain('USD-SOFR')
    expect(indexIds).toContain('USD-EFFR')
  })

  it('publishes one Discount contract per ccy via the interface template', async () => {
    const exercise = vi.fn().mockResolvedValue(undefined)
    const query = vi.fn().mockResolvedValue([{ contractId: 'provider-cid-1' }])
    const client = { query, exercise, create: vi.fn() }

    const config = {
      curves: {
        interpolation: 'LinearZero',
        currencies: {
          USD: {
            dayCount: 'Act360',
            discount: { provider: 'demo-stub' },
            projection: { indexId: 'USD-SOFR', provider: 'demo-stub' },
          },
        },
      },
      demo: {
        stubCurves: {
          USD: {
            discount: {
              pillars: [
                { tenorDays: 1, zeroRate: 0.05 },
                { tenorDays: 365, zeroRate: 0.04 },
              ],
            },
            projections: {
              'USD-SOFR': {
                pillars: [
                  { tenorDays: 1, zeroRate: 0.05 },
                  { tenorDays: 365, zeroRate: 0.04 },
                ],
              },
            },
          },
        },
      },
      floatingRateIndices: {},
    } as never

    registerProvider(buildDemoStubProvider(config))

    await seedCurves(client as never, config)

    const discountCalls = exercise.mock.calls.filter(
      (c) => (c[0] as { choice: string }).choice === 'Provider_PublishDiscountCurve',
    )
    expect(discountCalls).toHaveLength(1)
    const call = discountCalls[0][0] as {
      templateId: string
      argument: { currency: string }
    }
    expect(call.templateId).toBe(IRSFORGE_PROVIDER_INTERFACE_ID)
    expect(call.argument.currency).toBe('USD')
  })

  it('warns and skips when no stub projections configured', async () => {
    const exercise = vi.fn().mockResolvedValue(undefined)
    const query = vi.fn().mockResolvedValue([{ contractId: 'provider-cid-1' }])
    const client = { query, exercise, create: vi.fn() }

    const config = {
      curves: {
        interpolation: 'LinearZero',
        currencies: {
          USD: {
            dayCount: 'Act360',
            discount: { provider: 'demo-stub' },
            projection: { indexId: 'USD-SOFR', provider: 'demo-stub' },
          },
        },
      },
      demo: {
        // stubCurves has discount but no projections key
        stubCurves: {
          USD: {
            discount: {
              pillars: [
                { tenorDays: 1, zeroRate: 0.05 },
                { tenorDays: 365, zeroRate: 0.04 },
              ],
            },
          },
        },
      },
      floatingRateIndices: {},
    } as never

    registerProvider(buildDemoStubProvider(config))

    await seedCurves(client as never, config)

    const projCalls = exercise.mock.calls.filter(
      (c) => (c[0] as { choice: string }).choice === 'Provider_PublishProjectionCurve',
    )
    expect(projCalls).toHaveLength(0)
  })
})
