import { describe, expect, it } from 'vitest'
import type { LedgerClient } from '../../../shared/ledger-client.js'
import {
  CURVE_TEMPLATE_ID,
  DAML_FINANCE_OBSERVATION_TEMPLATE_ID,
  FLOATING_RATE_INDEX_TEMPLATE_ID,
} from '../../../shared/template-ids.js'
import { buildContextFromSnapshot } from '../replay.js'
import { curveRow, fakeClient, indexRow, obsRow } from './fixtures/replay-fixtures.js'

describe('buildContextFromSnapshot — error paths', () => {
  it('errors loudly when a snapshot curveCid is not on chain', async () => {
    const client = fakeClient({})
    await expect(
      buildContextFromSnapshot(
        client,
        {
          curveCids: ['missing'],
          indexCids: [],
          observationCutoff: '2026-04-17T12:00:00Z',
          swapCids: [],
        },
        'USD',
      ),
    ).rejects.toThrow(/curve missing missing from ledger/)
  })

  it('errors loudly when a snapshot indexCid is not on chain', async () => {
    const client = fakeClient({
      [CURVE_TEMPLATE_ID]: [curveRow('c1')],
    })
    await expect(
      buildContextFromSnapshot(
        client,
        {
          curveCids: ['c1'],
          indexCids: ['missing-idx'],
          observationCutoff: '2026-04-17T12:00:00Z',
          swapCids: [],
        },
        'USD',
      ),
    ).rejects.toThrow(/index missing-idx missing from ledger/)
  })

  it('errors when snapshot names a curve but none discount-matches the ccy', async () => {
    const client = fakeClient({
      [CURVE_TEMPLATE_ID]: [curveRow('c1', { curveType: 'Projection', indexId: 'USD-SOFR' })],
    })
    await expect(
      buildContextFromSnapshot(
        client,
        {
          curveCids: ['c1'],
          indexCids: [],
          observationCutoff: '2026-04-17T12:00:00Z',
          swapCids: [],
        },
        'USD',
      ),
    ).rejects.toThrow(/no Discount curve/)
  })

  it('propagates Canton query errors instead of swallowing them', async () => {
    // Error mid-stream: Canton JSON API throws. Replay must surface it,
    // never return a half-built ctx (per feedback_no_defensive_fallbacks).
    const boom: LedgerClient = {
      query: async () => {
        throw new Error('canton: connection reset')
      },
    } as unknown as LedgerClient
    await expect(
      buildContextFromSnapshot(
        boom,
        {
          curveCids: ['c1'],
          indexCids: [],
          observationCutoff: '2026-04-17T12:00:00Z',
          swapCids: [],
        },
        'USD',
      ),
    ).rejects.toThrow(/canton: connection reset/)
  })
})

describe('buildContextFromSnapshot — observation history', () => {
  it('returns empty observations when the primary index has no on-chain observations', async () => {
    // Empty history: the FloatingRateIndex exists but no Observation
    // contract for it has been published yet. flattenObservations should
    // return [], and the ctx should still build successfully.
    const client = fakeClient({
      [CURVE_TEMPLATE_ID]: [curveRow('c1', { currency: 'USD', curveType: 'Discount' })],
      [FLOATING_RATE_INDEX_TEMPLATE_ID]: [indexRow('idx1')],
      [DAML_FINANCE_OBSERVATION_TEMPLATE_ID]: [],
    })
    const ctx = await buildContextFromSnapshot(
      client,
      {
        curveCids: ['c1'],
        indexCids: ['idx1'],
        observationCutoff: '2026-04-17T12:00:00Z',
        swapCids: [],
      },
      'USD',
    )
    expect(ctx.observations).toEqual([])
    expect(ctx.curve.currency).toBe('USD')
    expect(ctx.index?.indexId).toBe('USD-SOFR')
  })

  it('returns observations only up to the cutoff (partial window)', async () => {
    // Partial window: history has observations both before and after the
    // requested cutoff. Replay must drop the post-cutoff samples.
    const client = fakeClient({
      [CURVE_TEMPLATE_ID]: [curveRow('c1')],
      [FLOATING_RATE_INDEX_TEMPLATE_ID]: [indexRow('idx1')],
      [DAML_FINANCE_OBSERVATION_TEMPLATE_ID]: [
        obsRow('o1', 'USD-SOFR', [
          ['2026-04-15T00:00:00Z', '0.0530'],
          ['2026-04-16T00:00:00Z', '0.0531'],
          ['2026-04-18T00:00:00Z', '0.0540'],
          ['2026-04-19T00:00:00Z', '0.0545'],
        ]),
      ],
    })
    const ctx = await buildContextFromSnapshot(
      client,
      {
        curveCids: ['c1'],
        indexCids: ['idx1'],
        observationCutoff: '2026-04-17T12:00:00Z',
        swapCids: [],
      },
      'USD',
    )
    expect(ctx.observations.map((o) => o.rate)).toEqual([0.053, 0.0531])
  })

  it('routes observations by indexId across multi-currency sandboxes', async () => {
    // Multi-currency: ledger has both USD-SOFR and EUR-ESTR observations.
    // The snapshot picks one as primary; the other must be filtered out.
    const client = fakeClient({
      [CURVE_TEMPLATE_ID]: [
        curveRow('cUsd', { currency: 'USD' }),
        curveRow('cEur', { currency: 'EUR' }),
      ],
      [FLOATING_RATE_INDEX_TEMPLATE_ID]: [
        indexRow('iUsd', { indexId: 'USD-SOFR', currency: 'USD' }),
        indexRow('iEur', { indexId: 'EUR-ESTR', currency: 'EUR', family: 'ESTR' }),
      ],
      [DAML_FINANCE_OBSERVATION_TEMPLATE_ID]: [
        obsRow('oUsd', 'USD-SOFR', [['2026-04-15T00:00:00Z', '0.0530']]),
        obsRow('oEur', 'EUR-ESTR', [['2026-04-15T00:00:00Z', '0.0390']]),
      ],
    })
    const ctxUsd = await buildContextFromSnapshot(
      client,
      {
        curveCids: ['cUsd'],
        indexCids: ['iUsd'],
        observationCutoff: '2026-04-17T12:00:00Z',
        swapCids: [],
      },
      'USD',
    )
    expect(ctxUsd.observations.map((o) => o.rate)).toEqual([0.053])
    expect(ctxUsd.curve.currency).toBe('USD')

    const ctxEur = await buildContextFromSnapshot(
      client,
      {
        curveCids: ['cEur'],
        indexCids: ['iEur'],
        observationCutoff: '2026-04-17T12:00:00Z',
        swapCids: [],
      },
      'EUR',
    )
    expect(ctxEur.observations.map((o) => o.rate)).toEqual([0.039])
    expect(ctxEur.curve.currency).toBe('EUR')
  })

  it('is idempotent when called twice with the same snapshot input', async () => {
    // Re-publish guarantee: shape, observations, and ordering must be
    // bit-identical across repeated calls. The publisher relies on this
    // to short-circuit on identical marks instead of writing duplicates.
    const client = fakeClient({
      [CURVE_TEMPLATE_ID]: [curveRow('c1')],
      [FLOATING_RATE_INDEX_TEMPLATE_ID]: [indexRow('idx1')],
      [DAML_FINANCE_OBSERVATION_TEMPLATE_ID]: [
        obsRow('o1', 'USD-SOFR', [
          ['2026-04-15T00:00:00Z', '0.0530'],
          ['2026-04-16T00:00:00Z', '0.0531'],
        ]),
      ],
    })
    const snap = {
      curveCids: ['c1'],
      indexCids: ['idx1'],
      observationCutoff: '2026-04-17T12:00:00Z',
      swapCids: [],
    }
    const a = await buildContextFromSnapshot(client, snap, 'USD')
    const b = await buildContextFromSnapshot(client, snap, 'USD')
    expect(b.observations.map((o) => ({ t: o.date.toISOString(), r: o.rate }))).toEqual(
      a.observations.map((o) => ({ t: o.date.toISOString(), r: o.rate })),
    )
    expect(b.curve).toEqual(a.curve)
    expect(b.index).toEqual(a.index)
  })

  it('produces a null index when the snapshot carries no indexCids', async () => {
    // Some single-leg / cash-only snapshots have no floating index. Ctx
    // should still build, with index=null and observations=[].
    const client = fakeClient({
      [CURVE_TEMPLATE_ID]: [curveRow('c1')],
      [FLOATING_RATE_INDEX_TEMPLATE_ID]: [],
      [DAML_FINANCE_OBSERVATION_TEMPLATE_ID]: [],
    })
    const ctx = await buildContextFromSnapshot(
      client,
      {
        curveCids: ['c1'],
        indexCids: [],
        observationCutoff: '2026-04-17T12:00:00Z',
        swapCids: [],
      },
      'USD',
    )
    expect(ctx.index).toBeNull()
    expect(ctx.observations).toEqual([])
  })
})
