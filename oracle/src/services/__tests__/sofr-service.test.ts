import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SOFR_INDEX_RATE_ID } from '../../shared/generated/rate-families'
import { resetState, state } from '../../shared/state'
import { NyFedSofrService } from '../sofr-service'

function fakeAllRatesResponse(rate: number, effectiveDate: string, indexValue = rate) {
  return {
    refRates: [
      {
        type: 'SOFR',
        effectiveDate,
        percentRate: rate,
        average30Day: rate,
        average90Day: rate,
        average180Day: rate,
      },
      { type: 'SOFRAI', effectiveDate, index: indexValue },
    ],
  }
}

describe('NyFedSofrService', () => {
  beforeEach(() => resetState())

  it('fetchAndBuildCurve returns 9-point curve and updates state.lastObservation', async () => {
    const fetcher = vi.fn().mockResolvedValue(fakeAllRatesResponse(5.3, '2026-04-13', 1.234567))
    const service = new NyFedSofrService({ fetcher, state })
    const points = await service.fetchAndBuildCurve('2026-04-13')
    expect(points).toHaveLength(9)
    expect(points[0].rateId).toBe('SOFR/ON')
    expect(state.lastObservation).not.toBeNull()
    expect(state.lastObservation!.rateId).toBe(SOFR_INDEX_RATE_ID)
    expect(state.lastObservation!.effectiveDate).toBe('2026-04-13')
    expect(state.lastObservation!.value).toBe(1.234567)
    expect(state.lastOvernightRate!.percent).toBe(5.3)
    expect(state.lastOvernightRate!.effectiveDate).toBe('2026-04-13')
  })

  it('fetchSingleRate populates state with the given rateId', async () => {
    const fetcher = vi.fn().mockResolvedValue(fakeAllRatesResponse(4.75, '2026-04-10', 99.9))
    const service = new NyFedSofrService({ fetcher, state })
    const obs = await service.fetchSingleRate(SOFR_INDEX_RATE_ID, '2026-04-10')
    expect(obs.value).toBe(99.9)
    expect(state.lastObservation!.effectiveDate).toBe('2026-04-10')
    expect(state.lastOvernightRate!.percent).toBe(4.75)
  })

  it('propagates fetcher errors', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('NY Fed 500'))
    const service = new NyFedSofrService({ fetcher, state })
    await expect(service.fetchAndBuildCurve('2026-04-13')).rejects.toThrow('NY Fed 500')
    expect(state.lastObservation).toBeNull()
  })
})
