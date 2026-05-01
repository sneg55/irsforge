import { describe, expect, it } from 'vitest'
import { hasNyFedProjectionProvider } from '../rate-cache.js'

describe('hasNyFedProjectionProvider', () => {
  const baseConfig = {
    floatingRateIndices: {
      'USD-SOFR': { currency: 'USD' },
      'EUR-ESTR': { currency: 'EUR' },
    },
    curves: {
      currencies: {
        USD: { projection: { provider: 'nyfed' } },
        EUR: { projection: { provider: 'demo-stub' } },
      },
    },
  }

  it('returns true when any index routes through nyfed', () => {
    expect(hasNyFedProjectionProvider(baseConfig)).toBe(true)
  })

  it('returns false when every index routes through demo-stub', () => {
    const config = {
      floatingRateIndices: { 'EUR-ESTR': { currency: 'EUR' } },
      curves: {
        currencies: { EUR: { projection: { provider: 'demo-stub' } } },
      },
    }
    expect(hasNyFedProjectionProvider(config)).toBe(false)
  })

  it('returns false when curves or indices are absent', () => {
    expect(hasNyFedProjectionProvider({})).toBe(false)
    expect(hasNyFedProjectionProvider({ floatingRateIndices: {} })).toBe(false)
    expect(hasNyFedProjectionProvider({ curves: { currencies: {} } })).toBe(false)
  })

  it('ignores indices whose currency has no curve entry', () => {
    const config = {
      floatingRateIndices: { 'XXX-?': { currency: 'XXX' } },
      curves: { currencies: {} },
    }
    expect(hasNyFedProjectionProvider(config)).toBe(false)
  })
})
