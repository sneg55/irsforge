import { describe, expect, it } from 'vitest'
import type { CurveBook, DiscountCurve } from '../types.js'

describe('CurveBook per-index shape', () => {
  it('accepts multiple projections per currency keyed by indexId', () => {
    const sofr: DiscountCurve = {
      currency: 'USD',
      curveType: 'Projection',
      indexId: 'USD-SOFR',
      asOf: '2026-01-01',
      pillars: [],
      interpolation: 'LinearZero',
      dayCount: 'Act360',
    }
    const effr: DiscountCurve = { ...sofr, indexId: 'USD-EFFR' }
    const book: CurveBook = {
      asOf: '2026-01-01',
      byCurrency: {
        USD: { discount: sofr, projections: { 'USD-SOFR': sofr, 'USD-EFFR': effr } },
      },
    }
    expect(Object.keys(book.byCurrency.USD.projections)).toHaveLength(2)
  })
})
