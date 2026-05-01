import { describe, expect, it } from 'vitest'
import { validateProviderRefs } from '../registry.js'

describe('validateProviderRefs', () => {
  it('returns empty when every reference resolves', () => {
    const errors = validateProviderRefs(
      {
        curves: {
          currencies: {
            USD: { discount: { provider: 'nyfed' }, projection: { provider: 'nyfed' } },
          },
        },
      },
      new Set(['nyfed']),
    )
    expect(errors).toEqual([])
  })

  it('returns one error per unregistered reference, with ccy + curveType + id', () => {
    const errors = validateProviderRefs(
      {
        curves: {
          currencies: {
            USD: { discount: { provider: 'demo-stub' }, projection: { provider: 'redstone' } },
            EUR: { discount: { provider: 'demo-stub' }, projection: { provider: 'demo-stub' } },
          },
        },
      },
      new Set(['demo-stub']),
    )
    expect(errors).toEqual([{ ccy: 'USD', curveType: 'projection', providerId: 'redstone' }])
  })

  it('handles empty config', () => {
    const errors = validateProviderRefs({}, new Set(['nyfed']))
    expect(errors).toEqual([])
  })
})
