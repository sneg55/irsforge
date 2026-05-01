import { describe, expect, it } from 'vitest'
import { flattenObservations, toDiscountCurve, toFloatingRateIndex } from '../replay-decode.js'
import type { CurvePayload, IndexPayload, ObservationPayload } from '../replay-types.js'

describe('toDiscountCurve', () => {
  it('parses pillar numerics and preserves metadata', () => {
    const payload: CurvePayload = {
      currency: 'USD',
      curveType: 'Discount',
      indexId: '',
      asOf: '2026-04-20T00:00:00Z',
      pillars: [
        { tenorDays: '1', zeroRate: '0.0531' },
        { tenorDays: '365', zeroRate: '0.0465' },
      ],
      interpolation: 'LinearZero',
      dayCount: 'Act360',
    } as unknown as CurvePayload

    const curve = toDiscountCurve(payload)

    expect(curve.pillars).toEqual([
      { tenorDays: 1, zeroRate: 0.0531 },
      { tenorDays: 365, zeroRate: 0.0465 },
    ])
    expect(curve.currency).toBe('USD')
    expect(curve.asOf).toBe('2026-04-20T00:00:00Z')
  })
})

describe('toFloatingRateIndex', () => {
  it('parses lookback and floor', () => {
    const payload: IndexPayload = {
      indexId: 'USD-SOFR',
      currency: 'USD',
      family: 'SOFR',
      compounding: 'CompoundedInArrears',
      lookback: '2',
      floor: '0.0',
    }

    const idx = toFloatingRateIndex(payload)

    expect(idx.lookback).toBe(2)
    expect(idx.floor).toBe(0)
    expect(idx.family).toBe('SOFR')
  })

  it('leaves floor as null when payload floor is null', () => {
    const payload: IndexPayload = {
      indexId: 'EUR-ESTR',
      currency: 'EUR',
      family: 'ESTR',
      compounding: 'CompoundedInArrears',
      lookback: '0',
      floor: null,
    }

    const idx = toFloatingRateIndex(payload)

    expect(idx.floor).toBeNull()
  })
})

describe('flattenObservations', () => {
  const mk = (
    indexId: string,
    obs: [string, string][],
  ): { contractId: string; payload: ObservationPayload } => ({
    contractId: `cid-${indexId}`,
    payload: {
      id: { unpack: indexId },
      observations: obs,
    },
  })

  it('filters by indexId and cutoff, then sorts ascending', () => {
    const rows = [
      mk('USD-SOFR', [
        ['2026-04-01T00:00:00Z', '0.053'],
        ['2026-04-03T00:00:00Z', '0.0535'],
      ]),
      mk('EUR-ESTR', [['2026-04-01T00:00:00Z', '0.039']]),
      mk('USD-SOFR', [['2026-04-02T00:00:00Z', '0.0531']]),
      // After cutoff — should be dropped.
      mk('USD-SOFR', [['2026-05-01T00:00:00Z', '0.06']]),
    ]

    const flat = flattenObservations(rows, 'USD-SOFR', '2026-04-15T00:00:00Z')

    expect(flat.map((o) => o.rate)).toEqual([0.053, 0.0531, 0.0535])
    expect(flat.every((o) => o.date <= new Date('2026-04-15T00:00:00Z'))).toBe(true)
  })

  it('returns empty when no rows match the indexId', () => {
    const rows = [mk('EUR-ESTR', [['2026-04-01T00:00:00Z', '0.039']])]
    expect(flattenObservations(rows, 'USD-SOFR', '2026-12-31T00:00:00Z')).toEqual([])
  })
})
