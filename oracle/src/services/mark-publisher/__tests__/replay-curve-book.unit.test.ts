// Phase 6 widening — bookCurveCids + fxSpotCids paths in
// buildContextFromSnapshot. Split out of replay.unit.test.ts to keep
// each test file under the 300-line house limit.

import { describe, expect, it } from 'vitest'
import {
  CURVE_TEMPLATE_ID,
  DAML_FINANCE_OBSERVATION_TEMPLATE_ID,
  FLOATING_RATE_INDEX_TEMPLATE_ID,
  FX_SPOT_TEMPLATE_ID,
} from '../../../shared/template-ids.js'
import { buildContextFromSnapshot } from '../replay.js'
import { curveRow, fakeClient, indexRow } from './fixtures/replay-fixtures.js'

describe('buildContextFromSnapshot — CurveBook (XCCY/FPML path)', () => {
  it('builds a CurveBook when bookCurveCids are present and pairs Discount+Projection per ccy', async () => {
    // XCCY / FPML path: snapshot carries bookCurveCids → buildCurveBook
    // must group by currency, attach the discount, and route the
    // projection under its indexId.
    const client = fakeClient({
      [CURVE_TEMPLATE_ID]: [
        curveRow('cUsdDisc', { currency: 'USD', curveType: 'Discount' }),
        curveRow('cUsdProj', {
          currency: 'USD',
          curveType: 'Projection',
          indexId: 'USD-SOFR',
        }),
        curveRow('cEurDisc', { currency: 'EUR', curveType: 'Discount' }),
        curveRow('cEurProj', {
          currency: 'EUR',
          curveType: 'Projection',
          indexId: 'EUR-ESTR',
        }),
      ],
      [FLOATING_RATE_INDEX_TEMPLATE_ID]: [indexRow('idx1')],
      [DAML_FINANCE_OBSERVATION_TEMPLATE_ID]: [],
    })
    const ctx = await buildContextFromSnapshot(
      client,
      {
        curveCids: ['cUsdDisc'],
        indexCids: ['idx1'],
        observationCutoff: '2026-04-17T12:00:00Z',
        swapCids: [],
        bookCurveCids: ['cUsdDisc', 'cUsdProj', 'cEurDisc', 'cEurProj'],
      },
      'USD',
    )
    expect(ctx.book).toBeDefined()
    expect(ctx.book?.byCurrency['USD']?.discount.currency).toBe('USD')
    expect(ctx.book?.byCurrency['USD']?.projections['USD-SOFR']).toBeDefined()
    expect(ctx.book?.byCurrency['EUR']?.discount.currency).toBe('EUR')
    expect(ctx.book?.byCurrency['EUR']?.projections['EUR-ESTR']).toBeDefined()
    expect(ctx.book?.asOf).toBe('2026-04-17T00:00:00Z')
  })

  it('drops a CurveBook entry whose ccy has Discount but no Projection', async () => {
    // Defensive: buildCurveBook only emits a paired entry when both
    // legs are present — half-pairs are silently filtered (not an error).
    const client = fakeClient({
      [CURVE_TEMPLATE_ID]: [
        curveRow('cUsdDisc', { currency: 'USD', curveType: 'Discount' }),
        curveRow('cEurDisc', { currency: 'EUR', curveType: 'Discount' }),
      ],
      [FLOATING_RATE_INDEX_TEMPLATE_ID]: [indexRow('idx1')],
      [DAML_FINANCE_OBSERVATION_TEMPLATE_ID]: [],
    })
    const ctx = await buildContextFromSnapshot(
      client,
      {
        curveCids: ['cUsdDisc'],
        indexCids: ['idx1'],
        observationCutoff: '2026-04-17T12:00:00Z',
        swapCids: [],
        bookCurveCids: ['cUsdDisc', 'cEurDisc'],
      },
      'USD',
    )
    expect(Object.keys(ctx.book?.byCurrency ?? {})).toEqual([])
  })

  it('errors when a bookCurveCid is missing from the on-ledger curve set', async () => {
    // The snapshot.curveCids guard fires first; to exercise the
    // buildCurveBook miss path we put a cid in bookCurveCids that is NOT
    // in snapshot.curveCids — that cid passes the snapshot precheck and
    // hits the secondary lookup inside buildCurveBook.
    const client = fakeClient({
      [CURVE_TEMPLATE_ID]: [curveRow('cUsdDisc')],
      [FLOATING_RATE_INDEX_TEMPLATE_ID]: [indexRow('idx1')],
      [DAML_FINANCE_OBSERVATION_TEMPLATE_ID]: [],
    })
    await expect(
      buildContextFromSnapshot(
        client,
        {
          curveCids: ['cUsdDisc'],
          indexCids: ['idx1'],
          observationCutoff: '2026-04-17T12:00:00Z',
          swapCids: [],
          bookCurveCids: ['cUsdDisc', 'phantom-cid'],
        },
        'USD',
      ),
    ).rejects.toThrow(/buildCurveBook: curve phantom-cid missing/)
  })
})

describe('buildContextFromSnapshot — FxSpots (XCCY path)', () => {
  it('fetches FX spots when fxSpotCids are present', async () => {
    const client = fakeClient({
      [CURVE_TEMPLATE_ID]: [curveRow('c1')],
      [FLOATING_RATE_INDEX_TEMPLATE_ID]: [indexRow('idx1')],
      [DAML_FINANCE_OBSERVATION_TEMPLATE_ID]: [],
      [FX_SPOT_TEMPLATE_ID]: [
        {
          contractId: 'fx1',
          payload: { baseCcy: 'EUR', quoteCcy: 'USD', rate: '1.10' },
        },
        {
          contractId: 'fx2',
          payload: { baseCcy: 'GBP', quoteCcy: 'USD', rate: '1.25' },
        },
      ],
    })
    const ctx = await buildContextFromSnapshot(
      client,
      {
        curveCids: ['c1'],
        indexCids: ['idx1'],
        observationCutoff: '2026-04-17T12:00:00Z',
        swapCids: [],
        fxSpotCids: ['fx1', 'fx2'],
      },
      'USD',
    )
    expect(ctx.fxSpots).toEqual({ EURUSD: 1.1, GBPUSD: 1.25 })
  })

  it('errors when a snapshot fxSpotCid is missing from the ledger', async () => {
    // Error mid-stream: ledger query returns partial data — replay must
    // not silently substitute. Same-shape guard as the curve/index checks.
    const client = fakeClient({
      [CURVE_TEMPLATE_ID]: [curveRow('c1')],
      [FLOATING_RATE_INDEX_TEMPLATE_ID]: [indexRow('idx1')],
      [DAML_FINANCE_OBSERVATION_TEMPLATE_ID]: [],
      [FX_SPOT_TEMPLATE_ID]: [],
    })
    await expect(
      buildContextFromSnapshot(
        client,
        {
          curveCids: ['c1'],
          indexCids: ['idx1'],
          observationCutoff: '2026-04-17T12:00:00Z',
          swapCids: [],
          fxSpotCids: ['fx-missing'],
        },
        'USD',
      ),
    ).rejects.toThrow(/fetchFxSpots: fxSpot fx-missing missing/)
  })
})
