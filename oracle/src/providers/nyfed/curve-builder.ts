import { SOFR_TENOR_DAYS as TENOR_DAYS } from '../../shared/generated/rate-families.js'
import type { CurvePoint, NYFedAllRatesResponse } from './types.js'

/**
 * Extracts a multi-tenor SOFR curve from the NY Fed "all rates" response.
 * Uses: overnight rate, 30D/90D/180D averages (directly from API),
 * then extrapolates 1Y-10Y using a simple spread model.
 */
export function buildCurveFromResponse(data: NYFedAllRatesResponse): CurvePoint[] {
  const sofrEntry = data.refRates.find((r) => r.type === 'SOFR')
  if (sofrEntry?.percentRate == null) {
    throw new Error('SOFR overnight rate not found in response')
  }

  const overnight = sofrEntry.percentRate / 100 // API returns percentage
  const avg30 = sofrEntry.average30Day != null ? sofrEntry.average30Day / 100 : overnight
  const avg90 = sofrEntry.average90Day != null ? sofrEntry.average90Day / 100 : overnight
  const avg180 = sofrEntry.average180Day != null ? sofrEntry.average180Day / 100 : overnight

  // Direct from API: ON, 1M (≈30D avg), 3M (≈90D avg), 6M (≈180D avg)
  // Extrapolate longer tenors: assume term premium of ~-3bp/year from 6M
  // (inverted curve typical for SOFR when Fed is at terminal rate)
  const slope = (avg180 - overnight) / 182 // rate change per day
  const extrapolate = (days: number) => avg180 + slope * (days - 182)

  const points: CurvePoint[] = [
    { rateId: 'SOFR/ON', tenorDays: TENOR_DAYS['SOFR/ON'], rate: overnight },
    { rateId: 'SOFR/1M', tenorDays: TENOR_DAYS['SOFR/1M'], rate: avg30 },
    { rateId: 'SOFR/3M', tenorDays: TENOR_DAYS['SOFR/3M'], rate: avg90 },
    { rateId: 'SOFR/6M', tenorDays: TENOR_DAYS['SOFR/6M'], rate: avg180 },
    { rateId: 'SOFR/1Y', tenorDays: TENOR_DAYS['SOFR/1Y'], rate: extrapolate(365) },
    { rateId: 'SOFR/2Y', tenorDays: TENOR_DAYS['SOFR/2Y'], rate: extrapolate(730) },
    { rateId: 'SOFR/3Y', tenorDays: TENOR_DAYS['SOFR/3Y'], rate: extrapolate(1095) },
    { rateId: 'SOFR/5Y', tenorDays: TENOR_DAYS['SOFR/5Y'], rate: extrapolate(1826) },
    { rateId: 'SOFR/10Y', tenorDays: TENOR_DAYS['SOFR/10Y'], rate: extrapolate(3652) },
  ]

  return points
}

export interface OnChainPillar {
  tenorDays: number
  zeroRate: number
}

export function curvePointsToPillars(points: CurvePoint[]): OnChainPillar[] {
  return points.map((p) => ({ tenorDays: p.tenorDays, zeroRate: p.rate }))
}
